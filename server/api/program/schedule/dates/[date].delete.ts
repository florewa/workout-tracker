import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { clearDateSchedule, isIsoDate } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const date = decodeURIComponent(getRouterParam(event, 'date') ?? '')
  if (!isIsoDate(date)) throw createError({ statusCode: 400, statusMessage: 'Неверная дата' })
  await clearDateSchedule(db, date)
  return { ok: true }
})
