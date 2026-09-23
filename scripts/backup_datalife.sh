#!/usr/bin/env bash
# DataLife Account — nightly backup. Separate from homeme (its own folder,
# schedule and log). Backs up:
#   1. the database  (datalife_mongo)          -> db_<date>.archive.gz
#   2. uploaded files (the /app/uploads volume) -> uploads_<date>.tar.gz
# Each file is written to a .tmp name, checked, then renamed: a failed or
# truncated backup never replaces a good one. Keeps KEEP_DAYS days.
#
# Install (once):
#   chmod +x /opt/datalifeaccount/scripts/backup_datalife.sh
#   (crontab -l; echo '30 3 * * * /opt/datalifeaccount/scripts/backup_datalife.sh >> /opt/datalife-backups/backup.log 2>&1') | crontab -
#
# Restore the database (DESTRUCTIVE — replaces current data):
#   gunzip -c /opt/datalife-backups/db_<date>.archive.gz | docker exec -i datalife_mongo sh -c \
#     'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --drop'
# Restore uploaded files:
#   gunzip -c /opt/datalife-backups/uploads_<date>.tar.gz | docker cp - datalife_backend:/app/
#
# Restore from an OFF-SERVER copy (decrypt first):
#   rclone copy "$DATALIFE_BACKUP_REMOTE/db_<date>.archive.gz.gpg" /tmp/
#   gpg --batch --passphrase-file /root/.datalife_backup_key \
#       --decrypt /tmp/db_<date>.archive.gz.gpg > /tmp/db_<date>.archive.gz
#
# Off-server copy: a backup on the same server does not survive losing the
# server. If DATALIFE_BACKUP_REMOTE is set (an rclone remote, e.g.
# "storagebox:datalife"), each night's files are also copied there.
set -euo pipefail

DEST="${DATALIFE_BACKUP_DIR:-/opt/datalife-backups}"
KEEP_DAYS="${DATALIFE_BACKUP_KEEP_DAYS:-14}"
TS="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DEST"
log() { echo "$(date '+%F %T') $*"; }
fail() { log "ERROR: $*"; rm -f "$DEST"/*.tmp; exit 1; }

# 1) database — credentials come from the mongo container's own environment
DB_TMP="$DEST/db_$TS.archive.gz.tmp"
docker exec datalife_mongo sh -c \
  'mongodump --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive' \
  | gzip -9 > "$DB_TMP" || fail "mongodump failed"
gzip -t "$DB_TMP" || fail "database archive is corrupt"
[ "$(stat -c%s "$DB_TMP")" -gt 10240 ] || fail "database archive is suspiciously small ($(stat -c%s "$DB_TMP") bytes)"
mv "$DB_TMP" "$DEST/db_$TS.archive.gz"

# 2) uploaded files — docker cp streams the volume as a tar, no extra image needed
UP_TMP="$DEST/uploads_$TS.tar.gz.tmp"
docker cp datalife_backend:/app/uploads - | gzip -6 > "$UP_TMP" || fail "copying uploads failed"
gzip -t "$UP_TMP" || fail "uploads archive is corrupt"
mv "$UP_TMP" "$DEST/uploads_$TS.tar.gz"

# 3) retention
find "$DEST" -maxdepth 1 \( -name 'db_*.archive.gz' -o -name 'uploads_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

# 4) off-server copy — ENCRYPTED on this server before it leaves
#    The archives hold customers' payroll, national IDs and bank details, so
#    the copy that goes to third-party storage is encrypted here first: the
#    provider only ever holds ciphertext. Local copies stay plain for a fast
#    restore (anyone on this server already has the database).
#    KEY_FILE holds the passphrase — WITHOUT IT THE OFF-SERVER COPIES ARE
#    UNRECOVERABLE. Keep a copy of it somewhere other than this server.
if [ -n "${DATALIFE_BACKUP_REMOTE:-}" ]; then
  command -v rclone >/dev/null || fail "DATALIFE_BACKUP_REMOTE is set but rclone is not installed"
  command -v gpg >/dev/null || fail "gpg is not installed"
  KEY_FILE="${DATALIFE_BACKUP_KEY_FILE:-/root/.datalife_backup_key}"
  [ -s "$KEY_FILE" ] || fail "encryption key file $KEY_FILE is missing or empty"

  for f in "db_$TS.archive.gz" "uploads_$TS.tar.gz"; do
    gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
        --passphrase-file "$KEY_FILE" --output "$DEST/$f.gpg" "$DEST/$f" || fail "encrypting $f failed"
    rclone copy "$DEST/$f.gpg" "$DATALIFE_BACKUP_REMOTE" || fail "uploading $f.gpg failed"
    # confirm it actually landed, and with the same size
    local_size=$(stat -c%s "$DEST/$f.gpg")
    remote_size=$(rclone size "$DATALIFE_BACKUP_REMOTE/$f.gpg" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2)
    [ "$local_size" = "$remote_size" ] || fail "uploaded $f.gpg does not match ($local_size vs ${remote_size:-missing})"
    rm -f "$DEST/$f.gpg"                       # the encrypted copy is only for transit
  done

  # same retention off-server
  rclone delete "$DATALIFE_BACKUP_REMOTE" --min-age "${KEEP_DAYS}d" --include 'db_*.archive.gz.gpg' 2>/dev/null || true
  rclone delete "$DATALIFE_BACKUP_REMOTE" --min-age "${KEEP_DAYS}d" --include 'uploads_*.tar.gz.gpg' 2>/dev/null || true
  log "copied off-server (encrypted) to $DATALIFE_BACKUP_REMOTE"
else
  log "NOTE: no off-server copy (DATALIFE_BACKUP_REMOTE not set) — a backup on this server does not survive losing it"
fi

log "OK  db $(du -h "$DEST/db_$TS.archive.gz" | cut -f1)  uploads $(du -h "$DEST/uploads_$TS.tar.gz" | cut -f1)  kept: $(ls "$DEST"/db_*.archive.gz | wc -l) nights"
