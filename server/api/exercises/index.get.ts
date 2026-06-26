import { getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listExercises } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const q = getQuery(event)
  const search = typeof q.search === 'string' ? q.search : undefined
  return listExercises(db, { search })
})
