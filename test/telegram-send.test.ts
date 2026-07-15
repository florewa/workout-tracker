import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureTelegramMenuButton, sendWorkoutInvitation } from '~~/server/utils/telegram-send'

const originalBotUsername = process.env.BOT_USERNAME
const originalWebAppUrl = process.env.WEB_APP_URL

afterEach(() => {
  vi.unstubAllGlobals()
  process.env.BOT_USERNAME = originalBotUsername
  process.env.WEB_APP_URL = originalWebAppUrl
})

describe('Telegram notifications', () => {
  it('отправляет приглашение с кнопкой подключения', async () => {
    process.env.BOT_USERNAME = '@workout_test_bot'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('$fetch', fetchMock)

    expect(await sendWorkoutInvitation('token', {
      chatId: 123,
      inviterName: 'Данил',
      workoutId: 42,
    })).toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/bottoken/sendMessage'),
      expect.objectContaining({
        body: expect.objectContaining({
          chat_id: 123,
          reply_markup: {
            inline_keyboard: [[{
              text: 'Подключиться',
              url: 'https://t.me/workout_test_bot?startapp=workout_42',
            }]],
          },
        }),
      }),
    )
  })

  it('настраивает постоянную кнопку открытия приложения', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('$fetch', fetchMock)

    expect(await configureTelegramMenuButton('token', 'https://app.example.com')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/bottoken/setChatMenuButton'),
      expect.objectContaining({
        body: {
          menu_button: {
            type: 'web_app',
            text: 'Открыть приложение',
            web_app: { url: 'https://app.example.com' },
          },
        },
      }),
    )
  })
})
