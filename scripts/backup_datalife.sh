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

# 4) optional off-server copy
if [ -n "${DATALIFE_BACKUP_REMOTE:-}" ]; then
  command -v rclone >/dev/null || fail "DATALIFE_BACKUP_REMOTE is set but rclone is not installed"
  rclone copy "$DEST/db_$TS.archive.gz" "$DATALIFE_BACKUP_REMOTE" && \
  rclone copy "$DEST/uploads_$TS.tar.gz" "$DATALIFE_BACKUP_REMOTE" || fail "off-server copy failed"
  log "copied off-server to $DATALIFE_BACKUP_REMOTE"
fi

log "OK  db $(du -h "$DEST/db_$TS.archive.gz" | cut -f1)  uploads $(du -h "$DEST/uploads_$TS.tar.gz" | cut -f1)  kept: $(ls "$DEST"/db_*.archive.gz | wc -l) nights"
