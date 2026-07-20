#!/bin/sh
set -eu

: "${HEALTHCHECK_URL:?HEALTHCHECK_URL must be set}"
: "${BOT_TOKEN:?BOT_TOKEN must be set}"
: "${MONITOR_TELEGRAM_IDS:?MONITOR_TELEGRAM_IDS must be set}"

telegram_base="${TELEGRAM_API_BASE:-https://api.telegram.org}"
if curl --fail --silent --show-error --max-time 15 "${HEALTHCHECK_URL}" >/dev/null; then
  exit 0
fi

message="⚠️ «Твой Подход» недоступен: ${HEALTHCHECK_URL} ($(date -u +%Y-%m-%dT%H:%M:%SZ) UTC)"
old_ifs="${IFS}"
IFS=','
for raw_chat_id in ${MONITOR_TELEGRAM_IDS}; do
  chat_id="$(printf '%s' "${raw_chat_id}" | tr -d '[:space:]')"
  [ -n "${chat_id}" ] || continue
  curl --fail --silent --show-error --max-time 30 \
    -X POST "${telegram_base}/bot${BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${chat_id}" \
    --data-urlencode "text=${message}" >/dev/null
done
IFS="${old_ifs}"
exit 1
