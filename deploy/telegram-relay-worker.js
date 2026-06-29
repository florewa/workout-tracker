// Cloudflare Worker — relay для api.telegram.org.
// Нужен, когда сервер (РФ) не достаёт Telegram напрямую: приложение шлёт запросы
// на адрес воркера, воркер форвардит их в Telegram (Cloudflare не заблокирован).
//
// Деплой:
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker
//   2. Вставить этот код, Deploy
//   3. Скопировать URL воркера (https://<имя>.<аккаунт>.workers.dev)
//   4. На сервере в .env:  TELEGRAM_API_BASE=https://<имя>.<аккаунт>.workers.dev
//   5. docker compose -f docker-compose.prod.yml up -d --force-recreate app
//
// Путь и тело проксируются как есть: .../bot<token>/sendMessage → api.telegram.org/bot<token>/sendMessage

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = 'https://api.telegram.org' + url.pathname + url.search
    const init = { method: request.method }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
      init.headers = { 'content-type': request.headers.get('content-type') || 'application/json' }
    }
    return fetch(target, init)
  },
}
