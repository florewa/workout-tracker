import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { setWeeklySchedule } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const weekday = Number(getRouterParam(event, 'weekday'))
  const body = await readBody<{ dayId?: number }>(event)
  const dayId = Number(body?.dayId)
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный день недели' })
  }
  if (!Number.isInteger(dayId) || dayId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверная программа' })
  }
  try {
    await setWeeklySchedule(db, weekday, dayId)
  } catch (error) {
    if ((error as Error).message === 'PROGRAM_DAY_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Программа не найдена' })
    }
    throw error
  }
  return { ok: true }
})
