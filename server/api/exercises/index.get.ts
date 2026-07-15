import { getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listExercises, listExercisesFull } from '~~/server/services/exercises'
import { listFavoriteExercises } from '~~/server/services/favorites'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const q = getQuery(event)
  const search = typeof q.search === 'string' ? q.search : undefined
  // full=1 — банк (категория/картинка/фильтр), иначе простой список для пикеров
  if (q.full) {
    const categoryId = q.categoryId ? Number(q.categoryId) : undefined
    const [list, favorites] = await Promise.all([
      listExercisesFull(db, { search, categoryId: Number.isInteger(categoryId) ? categoryId : undefined }),
      listFavoriteExercises(db, me.id),
    ])
    const favoriteIds = new Set(favorites.map(item => item.exerciseId))
    return list.map(item => ({ ...item, isFavorite: favoriteIds.has(item.id) }))
  }
  return listExercises(db, { search })
})
