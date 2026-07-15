import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { changeWorkoutDay, isWorkoutMember } from '~~/server/services/workouts'
import { broadcastWorkoutChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ dayId?: number }>(event)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  if (!Number.isInteger(body?.dayId) || body.dayId! <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен dayId' })
  }
  if (!(await isWorkoutMember(db, id, me.id))) {
    throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  }
  if (!(await changeWorkoutDay(db, id, body.dayId!))) {
    throw createError({ statusCode: 409, statusMessage: 'Тренировка уже завершена' })
  }
  broadcastWorkoutChanged(id)
  return { ok: true }
})
