import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { setWeeklySchedule } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const weekday = Number(getRouterParam(event, 'weekday'))
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный день недели' })
  }
  await setWeeklySchedule(db, weekday, null)
  return { ok: true }
})
