import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { isWorkoutMember, trashWorkout } from '~~/server/services/workouts'
import { broadcastWorkoutChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  if (!(await isWorkoutMember(db, id, me.id))) throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  if (!(await trashWorkout(db, id))) throw createError({ statusCode: 409, statusMessage: 'Тренировка уже удалена' })
  broadcastWorkoutChanged(id)
  return { ok: true }
})
