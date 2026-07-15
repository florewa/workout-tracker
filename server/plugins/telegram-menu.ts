import { configureTelegramMenuButton } from '~~/server/utils/telegram-send'

export default defineNitroPlugin(async () => {
  const token = process.env.BOT_TOKEN
  const webAppUrl = process.env.WEB_APP_URL
  if (!token || !webAppUrl) return

  const ok = await configureTelegramMenuButton(token, webAppUrl)
  if (!ok) console.warn('Не удалось настроить кнопку открытия приложения в Telegram-боте')
})
