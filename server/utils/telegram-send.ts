// Отправка сообщения пользователю через Bot API. Возвращает true при успехе.
// Базовый URL настраивается (TELEGRAM_API_BASE) — на серверах, где api.telegram.org
// заблокирован, можно указать relay (например, Cloudflare Worker).
interface TelegramMessageOptions {
  replyMarkup?: Record<string, unknown>
}

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  options: TelegramMessageOptions = {},
): Promise<boolean> {
  const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  try {
    const res = await $fetch<{ ok: boolean }>(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      timeout: 5000,
      body: {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      },
    })
    return res?.ok === true
  } catch {
    // юзер не стартовал бота / заблокировал / сеть — пропускаем
    return false
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export async function sendWorkoutInvitation(
  token: string,
  input: { chatId: number; inviterName: string; workoutId: number },
): Promise<boolean> {
  const bot = (process.env.BOT_USERNAME ?? '').replace(/^@/, '')
  const webAppUrl = (process.env.WEB_APP_URL ?? '').replace(/\/$/, '')
  const startParam = `workout_${input.workoutId}`

  let button: Record<string, unknown> | null = null
  if (bot) {
    button = { text: 'Подключиться', url: `https://t.me/${bot}?startapp=${startParam}` }
  } else if (webAppUrl) {
    button = { text: 'Подключиться', web_app: { url: `${webAppUrl}?workout=${input.workoutId}` } }
  }

  return sendTelegramMessage(
    token,
    input.chatId,
    `<b>${escapeHtml(input.inviterName)}</b> приглашает тебя на совместную тренировку.\nРежим: каждый записывает свои подходы сам.`,
    button ? { replyMarkup: { inline_keyboard: [[button]] } } : {},
  )
}

export async function configureTelegramMenuButton(token: string, webAppUrl: string): Promise<boolean> {
  const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  try {
    const res = await $fetch<{ ok: boolean }>(`${base}/bot${token}/setChatMenuButton`, {
      method: 'POST',
      timeout: 5000,
      body: {
        menu_button: {
          type: 'web_app',
          text: 'Открыть приложение',
          web_app: { url: webAppUrl },
        },
      },
    })
    return res?.ok === true
  } catch {
    return false
  }
}
