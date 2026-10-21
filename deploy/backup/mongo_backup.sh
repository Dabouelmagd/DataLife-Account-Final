#!/usr/bin/env bash
# DataLife Account — MongoDB backup (runs on the HOST, from root's cron).
#
#   1. mongodump --archive --gzip inside the datalife_mongo container
#      (credentials read from the container's own environment, never stored
#      here, never on any command line, never in the log)
#   2. verifies the archive with mongorestore --dryRun
#   3. rotation: 14 daily + 8 weekly + 6 monthly
#   4. optional off-site copy (rclone or S3/B2 with the aws cli), encrypted
#      with gpg first unless you say otherwise
#   5. writes a status file with NO secrets: $BACKUP_DIR/status/last_backup.json
#      (+ symlink $BACKUP_DIR/last_backup.json) — the backend shows it to
#      platform admins at GET /api/backup/status
#
# Settings (environment, or /etc/datalife-backup.env — sourced if present):
#   BACKUP_DIR          default /var/backups/datalife
#   MONGO_CONTAINER     default datalife_mongo
#   BACKEND_CONTAINER   default datalife_backend (DB name + uploads are read from it)
#   DB_NAME             default: DB_NAME of the backend container, else "datalife"
#   KEEP_DAILY / KEEP_WEEKLY / KEEP_MONTHLY   default 14 / 8 / 6
#   INCLUDE_UPLOADS     default 1 — also archive /app/uploads (logos, attachments)
#   RCLONE_REMOTE       e.g. "storagebox:datalife"     -> rclone copy
#   S3_BUCKET           e.g. "s3://my-bucket/datalife" -> aws s3 cp
#   S3_ENDPOINT_URL     e.g. https://s3.eu-central-003.backblazeb2.com (B2/Hetzner/Wasabi)
#                       (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the env file or ~/.aws)
#   BACKUP_GPG_KEY_FILE default /root/.datalife_backup_key — passphrase used to
#                       encrypt off-site copies. KEEP A COPY OF IT OFF THE SERVER.
#   OFFSITE_ALLOW_PLAINTEXT=1  only if the remote encrypts itself (rclone crypt)
set -euo pipefail
umask 077

ENV_FILE="${BACKUP_ENV_FILE:-/etc/datalife-backup.env}"
if [ -r "$ENV_FILE" ]; then
  set -a          # every setting in the file is exported (aws cli needs AWS_*)
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/datalife}"
MONGO_CONTAINER="${MONGO_CONTAINER:-datalife_mongo}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-datalife_backend}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
INCLUDE_UPLOADS="${INCLUDE_UPLOADS:-1}"
GPG_KEY_FILE="${BACKUP_GPG_KEY_FILE:-/root/.datalife_backup_key}"
STATUS_DIR="$BACKUP_DIR/status"
CONF_IN_CONTAINER="/tmp/.datalife_backup_$$.yaml"

START_EPOCH="$(date +%s)"
STAMP="$(date +%Y%m%d-%H%M)"
FILE="datalife-$STAMP.archive.gz"
UPLOADS_FILE="uploads-$STAMP.tar.gz"
VERIFIED=false
OFFSITE="none"
SIZE=0
SHA=""

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >&2; }

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\n\r'; }

write_status() {   # $1 = ok (true/false)  $2 = error text
  local ok="$1" err="${2:-}" kept tmp
  kept="$(find "$BACKUP_DIR" -maxdepth 1 -name 'datalife-*.archive.gz' | wc -l | tr -d ' ')"
  mkdir -p "$STATUS_DIR"
  chmod 755 "$STATUS_DIR"
  tmp="$STATUS_DIR/.last_backup.json.tmp"
  cat > "$tmp" <<JSON
{
  "time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "file": "$(json_escape "$FILE")",
  "size": ${SIZE:-0},
  "sha256": "$(json_escape "$SHA")",
  "verified": $VERIFIED,
  "offsite": "$(json_escape "$OFFSITE")",
  "ok": $ok,
  "error": "$(json_escape "$err")",
  "db": "$(json_escape "${DB_NAME:-}")",
  "kept": ${kept:-0},
  "duration_seconds": $(( $(date +%s) - START_EPOCH ))
}
JSON
  chmod 644 "$tmp"
  mv -f "$tmp" "$STATUS_DIR/last_backup.json"
  ln -sfn "status/last_backup.json" "$BACKUP_DIR/last_backup.json"
}

cleanup() {
  docker exec "$MONGO_CONTAINER" rm -f "$CONF_IN_CONTAINER" >/dev/null 2>&1 || true
  rm -f "$BACKUP_DIR"/*.tmp "$BACKUP_DIR"/*.gpg 2>/dev/null || true
}

fail() {
  log "ERROR: $*"
  write_status false "$*" || true
  exit 1
}

trap cleanup EXIT

# one run at a time
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.lock"
if ! flock -n 9; then
  log "another backup is running — exiting"
  exit 0
fi

command -v docker >/dev/null || fail "docker is not installed"
docker inspect -f '{{.State.Running}}' "$MONGO_CONTAINER" 2>/dev/null | grep -q true \
  || fail "container $MONGO_CONTAINER is not running"

# ── credentials: from the running container, kept in memory only ──────────
MONGO_USER="$(docker exec "$MONGO_CONTAINER" printenv MONGO_INITDB_ROOT_USERNAME || true)"
MONGO_PASS="$(docker exec "$MONGO_CONTAINER" printenv MONGO_INITDB_ROOT_PASSWORD || true)"
[ -n "$MONGO_USER" ] && [ -n "$MONGO_PASS" ] || fail "could not read MONGO_INITDB_ROOT_* from $MONGO_CONTAINER"
if [ -z "${DB_NAME:-}" ]; then
  DB_NAME="$(docker exec "$BACKEND_CONTAINER" printenv DB_NAME 2>/dev/null || true)"
  DB_NAME="${DB_NAME:-datalife}"
fi

# The password goes to the mongo tools through a config file written inside
# the container via stdin (mode 600, removed on exit) — not as -p, which any
# user could read in `ps`.
yaml_pass="${MONGO_PASS//\'/\'\'}"
printf "password: '%s'\n" "$yaml_pass" \
  | docker exec -i "$MONGO_CONTAINER" sh -c "umask 077; cat > '$CONF_IN_CONTAINER'" \
  || fail "could not prepare the credentials file in the container"
unset MONGO_PASS yaml_pass

mongo_tool() {   # mongo_tool <mongodump|mongorestore> [args...]
  local tool="$1"; shift
  docker exec -i "$MONGO_CONTAINER" "$tool" --config="$CONF_IN_CONTAINER" \
    -u "$MONGO_USER" --authenticationDatabase admin "$@"
}

# ── 1. dump ────────────────────────────────────────────────────────────────
log "dumping database $DB_NAME"
TMP="$BACKUP_DIR/$FILE.tmp"
if ! mongo_tool mongodump --quiet --db "$DB_NAME" --archive --gzip > "$TMP"; then
  fail "mongodump failed"
fi
SIZE="$(stat -c%s "$TMP")"
[ "$SIZE" -gt 1024 ] || fail "archive is suspiciously small ($SIZE bytes)"

# ── 2. verify ──────────────────────────────────────────────────────────────
# --dryRun reads the whole archive (and its gzip blocks) without writing; a
# truncated or corrupt file fails here. The verbose output must name the db.
VERIFY_OUT="$(mongo_tool mongorestore --dryRun --verbose --archive --gzip \
              --nsInclude "$DB_NAME.*" < "$TMP" 2>&1)" || fail "mongorestore --dryRun failed on the archive"
printf '%s' "$VERIFY_OUT" | grep -q "$DB_NAME\." || fail "verification did not find any $DB_NAME collection in the archive"
VERIFIED=true
SHA="$(sha256sum "$TMP" | cut -d' ' -f1)"
mv "$TMP" "$BACKUP_DIR/$FILE"
log "ok  $FILE  $(du -h "$BACKUP_DIR/$FILE" | cut -f1)  verified"

# uploaded files (logos, attachments, employee documents) — not in the db
if [ "$INCLUDE_UPLOADS" = "1" ]; then
  UTMP="$BACKUP_DIR/$UPLOADS_FILE.tmp"
  if docker cp "$BACKEND_CONTAINER:/app/uploads" - 2>/dev/null | gzip -6 > "$UTMP" && gzip -t "$UTMP"; then
    mv "$UTMP" "$BACKUP_DIR/$UPLOADS_FILE"
    log "ok  $UPLOADS_FILE  $(du -h "$BACKUP_DIR/$UPLOADS_FILE" | cut -f1)"
  else
    rm -f "$UTMP"
    log "WARNING: uploads archive failed (database backup is fine)"
    UPLOADS_FILE=""
  fi
else
  UPLOADS_FILE=""
fi

# ── 3. rotation: newest per day (14), per ISO week (8), per month (6) ──────
rotate() {   # rotate <prefix> <suffix>
  local prefix="$1" suffix="$2" f base d day week month
  declare -A keep=() seen_d=() seen_w=() seen_m=()
  local nd=0 nw=0 nm=0
  while IFS= read -r f; do
    base="$(basename "$f")"
    d="${base#"$prefix"-}"; d="${d%%-*}"                  # YYYYmmdd
    [[ "$d" =~ ^[0-9]{8}$ ]] || continue
    day="$d"; week="$(date -d "$d" +%G-%V)"; month="${d:0:6}"
    if [ -z "${seen_d[$day]:-}" ] && [ "$nd" -lt "$KEEP_DAILY" ]; then
      seen_d[$day]=1; nd=$((nd + 1)); keep[$base]=1
    fi
    if [ -z "${seen_w[$week]:-}" ] && [ "$nw" -lt "$KEEP_WEEKLY" ]; then
      seen_w[$week]=1; nw=$((nw + 1)); keep[$base]=1
    fi
    if [ -z "${seen_m[$month]:-}" ] && [ "$nm" -lt "$KEEP_MONTHLY" ]; then
      seen_m[$month]=1; nm=$((nm + 1)); keep[$base]=1
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "$prefix-*$suffix" | sort -r)
  while IFS= read -r f; do
    base="$(basename "$f")"
    if [ -z "${keep[$base]:-}" ]; then
      rm -f -- "$f" && log "rotated out $base"
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "$prefix-*$suffix")
}
rotate datalife .archive.gz
rotate uploads .tar.gz

# ── 4. off-site copy (optional) ────────────────────────────────────────────
offsite_files=("$FILE")
if [ -n "$UPLOADS_FILE" ]; then offsite_files+=("$UPLOADS_FILE"); fi

prepare_offsite() {   # prints the path to upload (encrypted unless allowed plain)
  local f="$1"
  if [ "${OFFSITE_ALLOW_PLAINTEXT:-0}" = "1" ]; then
    printf '%s\n' "$BACKUP_DIR/$f"; return 0
  fi
  command -v gpg >/dev/null || { log "gpg is not installed"; return 1; }
  [ -s "$GPG_KEY_FILE" ] || { log "encryption key $GPG_KEY_FILE missing (see README)"; return 1; }
  gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
      --passphrase-file "$GPG_KEY_FILE" --output "$BACKUP_DIR/$f.gpg" "$BACKUP_DIR/$f" || return 1
  printf '%s\n' "$BACKUP_DIR/$f.gpg"
}

if [ -n "${RCLONE_REMOTE:-}" ] || [ -n "${S3_BUCKET:-}" ]; then
  OFFSITE="failed"
  offsite_ok=1
  for f in "${offsite_files[@]}"; do
    src="$(prepare_offsite "$f")" || { offsite_ok=0; break; }
    if [ -n "${RCLONE_REMOTE:-}" ]; then
      command -v rclone >/dev/null || { log "rclone is not installed"; offsite_ok=0; break; }
      rclone copy --quiet "$src" "$RCLONE_REMOTE" || { offsite_ok=0; break; }
      local_size="$(stat -c%s "$src")"
      remote_size="$(rclone size --json "$RCLONE_REMOTE/$(basename "$src")" 2>/dev/null \
                     | grep -o '"bytes":[0-9]*' | cut -d: -f2 || true)"
      [ "$local_size" = "${remote_size:-}" ] || { log "remote size mismatch for $(basename "$src")"; offsite_ok=0; break; }
    fi
    if [ -n "${S3_BUCKET:-}" ]; then
      command -v aws >/dev/null || { log "aws cli is not installed"; offsite_ok=0; break; }
      s3_args=()
      [ -n "${S3_ENDPOINT_URL:-}" ] && s3_args+=(--endpoint-url "$S3_ENDPOINT_URL")
      aws "${s3_args[@]}" s3 cp --only-show-errors "$src" "${S3_BUCKET%/}/$(basename "$src")" \
        || { offsite_ok=0; break; }
    fi
    if [ "$src" != "$BACKUP_DIR/$f" ]; then rm -f -- "$src"; fi
  done
  if [ "$offsite_ok" = 1 ]; then
    OFFSITE=""
    if [ -n "${RCLONE_REMOTE:-}" ]; then OFFSITE="rclone"; fi
    if [ -n "${S3_BUCKET:-}" ]; then OFFSITE="${OFFSITE:+$OFFSITE+}s3"; fi
    log "off-site copy ok ($OFFSITE)"
    # rclone: same retention as the longest local tier; S3/B2: use a bucket lifecycle rule
    if [ -n "${RCLONE_REMOTE:-}" ]; then
      rclone delete --quiet "$RCLONE_REMOTE" --min-age "$(( KEEP_MONTHLY * 31 ))d" \
        --include 'datalife-*' --include 'uploads-*' 2>/dev/null || true
    fi
  else
    write_status true "off-site copy failed (local backup is fine and verified)"
    log "ERROR: off-site copy failed (local backup is fine and verified)"
    exit 2
  fi
else
  log "NOTE: no off-site copy configured (RCLONE_REMOTE / S3_BUCKET) — a backup on this server does not survive losing it"
fi

write_status true ""
log "done in $(( $(date +%s) - START_EPOCH ))s — $(find "$BACKUP_DIR" -maxdepth 1 -name 'datalife-*.archive.gz' | wc -l) database archives kept"
