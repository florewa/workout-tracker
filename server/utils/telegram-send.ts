// Отправка сообщения пользователю через Bot API. Возвращает true при успехе.
// Базовый URL настраивается (TELEGRAM_API_BASE) — на серверах, где api.telegram.org
// заблокирован, можно указать relay (например, Cloudflare Worker).
export async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<boolean> {
  const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  try {
    const res = await $fetch<{ ok: boolean }>(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true },
    })
    return res?.ok === true
  } catch {
    // юзер не стартовал бота / заблокировал / сеть — пропускаем
    return false
  }
}
