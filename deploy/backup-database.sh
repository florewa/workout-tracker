#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BOT_TOKEN:?BOT_TOKEN must be set}"
: "${BACKUP_TELEGRAM_IDS:?BACKUP_TELEGRAM_IDS must be set}"

telegram_base="${TELEGRAM_API_BASE:-https://api.telegram.org}"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
dump_path="$(mktemp "/tmp/workout-backup-${stamp}.XXXXXX.sql")"
backup_path="$(mktemp "/tmp/workout-backup-${stamp}.XXXXXX.sql.gz")"
trap 'rm -f "${dump_path}" "${backup_path}"' EXIT HUP INT TERM

# Plain SQL with DROP statements is human-readable after gunzip and can restore
# a fresh database. Uploaded avatars/images live in a separate volume and are
# intentionally not included.
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges > "${dump_path}"

dump_size="$(wc -c < "${dump_path}" | tr -d '[:space:]')"
if [ "${dump_size}" -le 32 ]; then
  echo "Database dump is unexpectedly empty" >&2
  exit 1
fi

gzip -9c "${dump_path}" > "${backup_path}"

backup_size="$(wc -c < "${backup_path}" | tr -d '[:space:]')"
if [ "${backup_size}" -le 32 ]; then
  echo "Backup is unexpectedly empty" >&2
  exit 1
fi

if [ "${backup_size}" -gt 50000000 ]; then
  echo "Backup exceeds Telegram Bot API document limit" >&2
  exit 1
fi

old_ifs="${IFS}"
sent_count=0
IFS=','
for raw_chat_id in ${BACKUP_TELEGRAM_IDS}; do
  chat_id="$(printf '%s' "${raw_chat_id}" | tr -d '[:space:]')"
  [ -n "${chat_id}" ] || continue
  curl --fail --silent --show-error \
    --max-time 120 \
    -X POST "${telegram_base}/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${chat_id}" \
    -F "caption=Твой Подход — полный бэкап БД ${stamp} UTC" \
    -F "document=@${backup_path};filename=workout-backup-${stamp}.sql.gz" \
    >/dev/null
  sent_count=$((sent_count + 1))
  echo "Backup sent to Telegram chat ${chat_id}"
done
IFS="${old_ifs}"

if [ "${sent_count}" -eq 0 ]; then
  echo "BACKUP_TELEGRAM_IDS does not contain a recipient" >&2
  exit 1
fi
