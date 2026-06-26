import { createError, getQuery, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { lastSet } from '~~/server/services/sets'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const exerciseId = Number(getRouterParam(event, 'id'))
  const userId = Number(getQuery(event).userId)
  if (!Number.isInteger(exerciseId) || !Number.isInteger(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны exerciseId и userId' })
  }
  return lastSet(db, userId, exerciseId)
})
