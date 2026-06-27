import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getWorkout, isWorkoutMember, finishWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })

  const existing = await getWorkout(db, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  if (!(await isWorkoutMember(db, id, me.id))) throw createError({ statusCode: 403, statusMessage: 'Нет доступа' })

  await finishWorkout(db, id)
  return { ok: true }
})
