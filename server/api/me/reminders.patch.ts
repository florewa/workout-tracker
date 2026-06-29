import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { setReminders } from '~~/server/services/reminders'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ enabled: boolean }>(event)
  if (typeof body?.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'enabled обязателен' })
  await setReminders(db, me.id, body.enabled)
  return { ok: true, enabled: body.enabled }
})
