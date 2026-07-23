#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BOT_TOKEN:?BOT_TOKEN must be set}"
: "${BACKUP_TELEGRAM_IDS:?BACKUP_TELEGRAM_IDS must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"

telegram_base="${TELEGRAM_API_BASE:-https://api.telegram.org}"
postgres_host="${POSTGRES_HOST:-db}"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
safe_stamp="$(printf '%s' "${stamp}" | tr -d ':-')"
dump_path="$(mktemp "/tmp/workout-backup-${safe_stamp}.dump.XXXXXX")"
deliver_path="${dump_path}"
verify_db="workout_restore_check_${safe_stamp}_$$"
verify_created=0
sent_count=0
export PGPASSWORD="${POSTGRES_PASSWORD}"

send_failure() {
  message="Бэкап «Твой Подход» НЕ СОЗДАН (${stamp} UTC). Проверь backup-cron.log."
  old_ifs="${IFS}"
  IFS=','
  for raw_chat_id in ${BACKUP_TELEGRAM_IDS}; do
    chat_id="$(printf '%s' "${raw_chat_id}" | tr -d '[:space:]')"
    [ -n "${chat_id}" ] || continue
    curl --silent --show-error --max-time 30 \
      -X POST "${telegram_base}/bot${BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${chat_id}" \
      --data-urlencode "text=${message}" >/dev/null || true
  done
  IFS="${old_ifs}"
}

cleanup() {
  status=$?
  if [ "${verify_created}" -eq 1 ]; then
    dropdb --if-exists --force --host "${postgres_host}" --username "${POSTGRES_USER}" "${verify_db}" >/dev/null 2>&1 || true
  fi
  rm -f "${dump_path}"
  if [ "${deliver_path}" != "${dump_path}" ]; then rm -f "${deliver_path}"; fi
  if [ "${status}" -ne 0 ]; then send_failure; fi
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Custom dump сохраняет схему и данные без владельцев и восстанавливается pg_restore.
# Аватары и изображения намеренно остаются вне архива.
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="${dump_path}"

dump_size="$(wc -c < "${dump_path}" | tr -d '[:space:]')"
if [ "${dump_size}" -le 128 ]; then
  echo "Database dump is unexpectedly empty" >&2
  exit 1
fi

# Настоящая проверка восстановления: временная БД, полный restore и smoke-query.
createdb --host "${postgres_host}" --username "${POSTGRES_USER}" "${verify_db}"
verify_created=1
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --host "${postgres_host}" \
  --username "${POSTGRES_USER}" \
  --dbname "${verify_db}" \
  "${dump_path}"
psql --host "${postgres_host}" --username "${POSTGRES_USER}" --dbname "${verify_db}" \
  --set=ON_ERROR_STOP=1 --tuples-only \
  --command="select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('users','workouts','sets');" \
  | tr -d '[:space:]' | grep -qx '3'
dropdb --force --host "${postgres_host}" --username "${POSTGRES_USER}" "${verify_db}"
verify_created=0

# Шифрование публичным ключом age: на сервере хранится только публичный ключ,
# приватный ключ нужен лишь при аварийном восстановлении.
filename="workout-backup-${stamp}.dump"
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  deliver_path="${dump_path}.age"
  age --recipient "${BACKUP_AGE_RECIPIENT}" --output "${deliver_path}" "${dump_path}"
  filename="${filename}.age"
fi

backup_size="$(wc -c < "${deliver_path}" | tr -d '[:space:]')"
if [ "${backup_size}" -gt 50000000 ]; then
  echo "Backup exceeds Telegram Bot API document limit" >&2
  exit 1
fi

old_ifs="${IFS}"
IFS=','
for raw_chat_id in ${BACKUP_TELEGRAM_IDS}; do
  chat_id="$(printf '%s' "${raw_chat_id}" | tr -d '[:space:]')"
  [ -n "${chat_id}" ] || continue
  curl --fail --silent --show-error --max-time 120 \
    -X POST "${telegram_base}/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${chat_id}" \
    -F "caption=Твой Подход — проверенный полный бэкап БД ${stamp} UTC" \
    -F "document=@${deliver_path};filename=${filename}" >/dev/null
  sent_count=$((sent_count + 1))
  echo "Verified backup sent to Telegram chat ${chat_id}"
done
IFS="${old_ifs}"

if [ "${sent_count}" -eq 0 ]; then
  echo "BACKUP_TELEGRAM_IDS does not contain a recipient" >&2
  exit 1
fi
