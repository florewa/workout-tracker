import { createError, getRouterParam, getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { prefillValue } from '~~/server/services/defaults'
import { getVariation } from '~~/server/services/variations'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const userId = Number(getQuery(event).userId)
  if (!Number.isInteger(userId) || userId <= 0) throw createError({ statusCode: 400, statusMessage: 'userId обязателен' })
  const workoutId = Number(getQuery(event).workoutId)
  const rawVariation = getQuery(event).variationId
  const variationId = rawVariation == null ? undefined : rawVariation === 'base' ? null : Number(rawVariation)
  if (variationId != null && (!Number.isInteger(variationId) || variationId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Неверная вариация' })
  }
  if (variationId != null) {
    const variation = await getVariation(db, variationId)
    if (!variation || variation.exerciseId !== id) throw createError({ statusCode: 400, statusMessage: 'Вариация не относится к упражнению' })
  }
  return prefillValue(db, userId, id, Number.isInteger(workoutId) && workoutId > 0 ? workoutId : undefined, variationId)
})
