import { createError, getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { isIsoDate, resolveScheduleRange } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const from = typeof query.from === 'string' ? query.from : ''
  const to = typeof query.to === 'string' ? query.to : ''
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный диапазон дат' })
  }
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  if (days > 370) throw createError({ statusCode: 400, statusMessage: 'Диапазон не должен превышать 370 дней' })
  return resolveScheduleRange(db, from, to)
})
