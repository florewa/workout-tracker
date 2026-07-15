import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getExercise } from '~~/server/services/exercises'
import { listFavoriteExercises } from '~~/server/services/favorites'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const [ex, favorites] = await Promise.all([
    getExercise(db, id),
    listFavoriteExercises(db, me.id),
  ])
  if (!ex) throw createError({ statusCode: 404, statusMessage: 'Не найдено' })
  const canonicalId = ex.id
  return { ...ex, isFavorite: favorites.some(item => item.exerciseId === canonicalId) }
})
