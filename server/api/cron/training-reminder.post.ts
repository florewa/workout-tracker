import { createError, getHeader, getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { buildTrainingReminder } from '~~/server/services/reminders'
import { sendTelegramMessage } from '~~/server/utils/telegram-send'

// Вызывается по расписанию (cron на сервере) с заголовком x-cron-secret.
// В тренировочный день шлёт мотивашку всем, кто не отписался.
// ?preview=1 — вернуть текст без отправки.
export default defineEventHandler(async (event) => {
  if (!process.env.CRON_SECRET || getHeader(event, 'x-cron-secret') !== process.env.CRON_SECRET) {
    throw createError({ statusCode: 401, statusMessage: 'Нет доступа' })
  }
  const token = process.env.BOT_TOKEN
  if (!token) throw createError({ statusCode: 500, statusMessage: 'BOT_TOKEN не задан' })

  const reminder = await buildTrainingReminder(db)
  if (!reminder) return { sent: 0, reason: 'сегодня не тренировочный день' }

  if (getQuery(event).preview) {
    return { preview: reminder.text, recipients: reminder.recipients.length, day: reminder.plan.code }
  }

  let sent = 0
  for (const r of reminder.recipients) {
    if (await sendTelegramMessage(token, r.telegramId, reminder.text)) sent++
  }
  return { sent, total: reminder.recipients.length, day: reminder.plan.code }
})
