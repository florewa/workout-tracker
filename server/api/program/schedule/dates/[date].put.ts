import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { isIsoDate, setDateSchedule } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const date = decodeURIComponent(getRouterParam(event, 'date') ?? '')
  const body = await readBody<{ dayId?: number | null }>(event)
  const dayId = body?.dayId
  if (!isIsoDate(date)) throw createError({ statusCode: 400, statusMessage: 'Неверная дата' })
  if (dayId === undefined || (dayId !== null && (!Number.isInteger(dayId) || dayId <= 0))) {
    throw createError({ statusCode: 400, statusMessage: 'Неверная программа' })
  }
  try {
    await setDateSchedule(db, date, dayId)
  } catch (error) {
    if ((error as Error).message === 'PROGRAM_DAY_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Программа не найдена' })
    }
    throw error
  }
  return { ok: true }
})
