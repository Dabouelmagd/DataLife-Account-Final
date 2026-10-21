#!/usr/bin/env bash
# DataLife Account — restore a backup made by mongo_backup.sh.
#
# Restore DRILL (safe, default): restores the archive into a TEMPORARY
# database (datalife -> datalife_restore_test), prints every collection's
# document count next to the live database, then drops the temporary copy
# (keep it with --keep). The live database is never touched.
#
#   mongo_restore.sh /var/backups/datalife/datalife-20261021-0330.archive.gz
#   mongo_restore.sh latest                 # newest archive in BACKUP_DIR
#   mongo_restore.sh latest --keep          # leave datalife_restore_test for inspection
#
# Restore to LIVE (destructive): replaces the live database with the archive.
# You must type the database name to confirm. A safety dump of the current
# live data is taken first, and the backend is stopped during the restore.
#
#   mongo_restore.sh <archive> --to-live
#
# Off-site copies (*.gpg) are decrypted first with BACKUP_GPG_KEY_FILE.
# Options: --db NAME (default datalife / DB_NAME)   --test-db NAME
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
GPG_KEY_FILE="${BACKUP_GPG_KEY_FILE:-/root/.datalife_backup_key}"
CONF_IN_CONTAINER="/tmp/.datalife_restore_$$.yaml"

ARCHIVE=""
MODE="drill"
KEEP=0
DB="${DB_NAME:-}"
TEST_DB=""

usage() { sed -n '2,24p' "$0"; exit "${1:-0}"; }
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --to-live) MODE="live" ;;
    --keep) KEEP=1 ;;
    --db) DB="${2:?--db needs a name}"; shift ;;
    --test-db) TEST_DB="${2:?--test-db needs a name}"; shift ;;
    -h|--help) usage 0 ;;
    -*) die "unknown option $1" ;;
    *) ARCHIVE="$1" ;;
  esac
  shift
done
[ -n "$ARCHIVE" ] || usage 1

if [ "$ARCHIVE" = "latest" ]; then
  ARCHIVE="$(find "$BACKUP_DIR" -maxdepth 1 -name 'datalife-*.archive.gz' | sort | tail -n 1)"
  [ -n "$ARCHIVE" ] || die "no archive found in $BACKUP_DIR"
fi
[ -f "$ARCHIVE" ] || die "file not found: $ARCHIVE"

docker inspect -f '{{.State.Running}}' "$MONGO_CONTAINER" 2>/dev/null | grep -q true \
  || die "container $MONGO_CONTAINER is not running"

if [ -z "$DB" ]; then
  DB="$(docker exec "$BACKEND_CONTAINER" printenv DB_NAME 2>/dev/null || true)"
  DB="${DB:-datalife}"
fi
TEST_DB="${TEST_DB:-${DB}_restore_test}"
[ "$TEST_DB" != "$DB" ] || die "the test database name must differ from the live one"

WORK="$(mktemp -d)"
cleanup() {
  docker exec "$MONGO_CONTAINER" rm -f "$CONF_IN_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# decrypt an off-site copy
if [[ "$ARCHIVE" == *.gpg ]]; then
  [ -s "$GPG_KEY_FILE" ] || die "need the passphrase file $GPG_KEY_FILE to decrypt"
  out="$WORK/$(basename "${ARCHIVE%.gpg}")"
  gpg --batch --quiet --passphrase-file "$GPG_KEY_FILE" --decrypt "$ARCHIVE" > "$out" || die "decryption failed"
  ARCHIVE="$out"
fi

# credentials: from the container, through a 600 file inside it (never -p)
MONGO_USER="$(docker exec "$MONGO_CONTAINER" printenv MONGO_INITDB_ROOT_USERNAME || true)"
MONGO_PASS="$(docker exec "$MONGO_CONTAINER" printenv MONGO_INITDB_ROOT_PASSWORD || true)"
[ -n "$MONGO_USER" ] && [ -n "$MONGO_PASS" ] || die "could not read MONGO_INITDB_ROOT_* from $MONGO_CONTAINER"
yaml_pass="${MONGO_PASS//\'/\'\'}"
printf "password: '%s'\n" "$yaml_pass" \
  | docker exec -i "$MONGO_CONTAINER" sh -c "umask 077; cat > '$CONF_IN_CONTAINER'"
unset MONGO_PASS yaml_pass

mongo_tool() {
  local tool="$1"; shift
  docker exec -i "$MONGO_CONTAINER" "$tool" --config="$CONF_IN_CONTAINER" \
    -u "$MONGO_USER" --authenticationDatabase admin "$@"
}

# mongosh reads the password from the container's environment itself
mongo_eval() {   # mongo_eval '<js using `c` = admin connection>'
  docker exec "$MONGO_CONTAINER" mongosh --nodb --quiet --eval "
    const c = connect('mongodb://127.0.0.1:27017/admin');
    c.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD);
    $1"
}

counts() {   # counts <db>  -> lines "collection<TAB>count"
  mongo_eval "
    const d = c.getSiblingDB('$1');
    d.getCollectionNames().filter(n => !n.startsWith('system.')).sort()
      .forEach(n => print(n + '\t' + d.getCollection(n).estimatedDocumentCount()));"
}

compare() {   # compare <restored db> <live db>
  counts "$1" > "$WORK/restored.tsv"
  counts "$2" > "$WORK/live.tsv"
  printf '\n%-40s %12s %12s %10s\n' "collection" "backup" "live" "diff"
  printf '%s\n' "------------------------------------------------------------------------------"
  local total_b=0 total_l=0 missing=0
  while IFS=$'\t' read -r name nb; do
    nl="$(awk -F'\t' -v n="$name" '$1==n {print $2}' "$WORK/live.tsv")"
    nl="${nl:-0}"
    [ "$nl" = "0" ] && [ "$nb" != "0" ] && missing=$((missing + 1))
    printf '%-40s %12s %12s %10s\n' "$name" "$nb" "$nl" "$(( nl - nb ))"
    total_b=$((total_b + nb)); total_l=$((total_l + nl))
  done < "$WORK/restored.tsv"
  while IFS=$'\t' read -r name nl; do
    if ! awk -F'\t' -v n="$name" '$1==n {f=1} END {exit !f}' "$WORK/restored.tsv"; then
      printf '%-40s %12s %12s %10s\n' "$name (not in backup)" "-" "$nl" ""
    fi
  done < "$WORK/live.tsv"
  printf '%s\n' "------------------------------------------------------------------------------"
  printf '%-40s %12s %12s %10s\n' "TOTAL" "$total_b" "$total_l" "$(( total_l - total_b ))"
  printf '\nThe live database keeps changing after the backup, so small positive diffs are normal.\n'
  printf 'A collection with many documents in "live" but 0 in "backup" is NOT normal.\n'
  [ "$total_b" -gt 0 ] || die "the restored copy is empty — this backup is not usable"
  [ "$missing" -eq 0 ] || log "note: $missing collection(s) exist in the backup but are empty live"
}

if [ "$MODE" = "drill" ]; then
  log "restore drill: $(basename "$ARCHIVE") -> $TEST_DB (live $DB is not touched)"
  mongo_eval "c.getSiblingDB('$TEST_DB').dropDatabase();" >/dev/null
  start="$(date +%s)"
  mongo_tool mongorestore --quiet --archive --gzip \
    --nsInclude "$DB.*" --nsFrom "$DB.*" --nsTo "$TEST_DB.*" < "$ARCHIVE" \
    || die "mongorestore into $TEST_DB failed"
  log "restored in $(( $(date +%s) - start ))s"
  compare "$TEST_DB" "$DB"
  if [ "$KEEP" = "1" ]; then
    log "kept $TEST_DB — it holds a full copy of customer data; drop it when done:"
    log "  docker exec $MONGO_CONTAINER mongosh -u <user> -p --authenticationDatabase admin --eval \"db.getSiblingDB('$TEST_DB').dropDatabase()\""
  else
    mongo_eval "c.getSiblingDB('$TEST_DB').dropDatabase();" >/dev/null
    log "dropped $TEST_DB"
  fi
  log "DRILL OK — record the date and the time it took"
  exit 0
fi

# ── --to-live ──────────────────────────────────────────────────────────────
[ -t 0 ] || die "--to-live must be run interactively (it asks for confirmation)"
cat >&2 <<WARN

  !!! RESTORE TO LIVE !!!
  This REPLACES every collection of database "$DB" with the contents of
    $(basename "$ARCHIVE")
  Everything written after that backup is lost (a safety dump is taken first).

WARN
read -r -p "Type the database name ($DB) to confirm: " answer
[ "$answer" = "$DB" ] || die "confirmation did not match — nothing was changed"

mkdir -p "$BACKUP_DIR"
SAFETY="$BACKUP_DIR/pre-restore-$DB-$(date +%Y%m%d-%H%M).archive.gz"
log "safety dump of the current live data -> $SAFETY"
mongo_tool mongodump --quiet --db "$DB" --archive --gzip > "$SAFETY" || die "safety dump failed — nothing was changed"

backend_was_running=0
if docker inspect -f '{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null | grep -q true; then
  backend_was_running=1
  log "stopping $BACKEND_CONTAINER during the restore"
  docker stop "$BACKEND_CONTAINER" >/dev/null
fi
restart_backend() {
  if [ "$backend_was_running" = 1 ]; then docker start "$BACKEND_CONTAINER" >/dev/null && log "started $BACKEND_CONTAINER"; fi
}
trap 'restart_backend; cleanup' EXIT

mongo_tool mongorestore --quiet --archive --gzip --drop --nsInclude "$DB.*" < "$ARCHIVE" \
  || die "mongorestore failed — restore the safety dump: $0 $SAFETY --to-live"
log "restored $(basename "$ARCHIVE") into $DB"
counts "$DB" | awk -F'\t' '{printf "  %-40s %s\n", $1, $2}'
log "LIVE RESTORE DONE. Safety dump of the previous data: $SAFETY"
