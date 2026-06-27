import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { deleteSet, getSetOwnership } from '~~/server/services/sets'
import { isWorkoutMember } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })

  const own = await getSetOwnership(db, id)
  if (!own) throw createError({ statusCode: 404, statusMessage: 'Подход не найден' })
  if (!(await isWorkoutMember(db, own.workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }

  await deleteSet(db, id)
  return { ok: true }
})
