// Отправка сообщения пользователю через Bot API. Возвращает true при успехе.
export async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<boolean> {
  try {
    await $fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true },
    })
    return true
  } catch {
    // юзер мог не стартовать бота / заблокировать — пропускаем
    return false
  }
}
