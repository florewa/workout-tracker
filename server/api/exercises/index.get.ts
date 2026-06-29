import { getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listExercises, listExercisesFull } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const q = getQuery(event)
  const search = typeof q.search === 'string' ? q.search : undefined
  // full=1 — банк (категория/картинка/фильтр), иначе простой список для пикеров
  if (q.full) {
    const categoryId = q.categoryId ? Number(q.categoryId) : undefined
    return listExercisesFull(db, { search, categoryId: Number.isInteger(categoryId) ? categoryId : undefined })
  }
  return listExercises(db, { search })
})
