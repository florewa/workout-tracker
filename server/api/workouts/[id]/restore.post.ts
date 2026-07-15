import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { isWorkoutMember, restoreWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  if (!(await isWorkoutMember(db, id, me.id, true))) throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  if (!(await restoreWorkout(db, id))) {
    throw createError({ statusCode: 410, statusMessage: 'Срок хранения тренировки истёк' })
  }
  return { ok: true }
})
