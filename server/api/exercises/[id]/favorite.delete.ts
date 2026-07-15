import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { setExerciseFavorite } from '~~/server/services/favorites'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const exerciseId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный id упражнения' })
  }

  const result = await setExerciseFavorite(db, me.id, exerciseId, false)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Упражнение не найдено' })
  return result
})
