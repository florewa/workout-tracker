import { createError, getQuery, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { previousExerciseWorkout } from '~~/server/services/sets'
import { getVariation } from '~~/server/services/variations'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const exerciseId = Number(getRouterParam(event, 'id'))
  const userId = Number(getQuery(event).userId)
  const workoutId = Number(getQuery(event).workoutId)
  if (!Number.isInteger(exerciseId) || exerciseId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны exerciseId и userId' })
  }
  const rawVariation = getQuery(event).variationId
  const variationId = rawVariation == null ? undefined : rawVariation === 'base' ? null : Number(rawVariation)
  if (variationId != null && (!Number.isInteger(variationId) || variationId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Неверная вариация' })
  }
  if (variationId != null) {
    const variation = await getVariation(db, variationId)
    if (!variation || variation.exerciseId !== exerciseId) throw createError({ statusCode: 400, statusMessage: 'Вариация не относится к упражнению' })
  }
  return previousExerciseWorkout(
    db,
    userId,
    exerciseId,
    Number.isInteger(workoutId) && workoutId > 0 ? workoutId : undefined,
    variationId,
  )
})
