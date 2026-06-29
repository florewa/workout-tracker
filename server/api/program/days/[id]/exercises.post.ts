import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addExerciseToDay } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const dayId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(dayId) || dayId <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id дня' })
  const body = await readBody<{ exerciseId: number; targetSets?: number | null; targetReps?: string | null }>(event)
  if (typeof body?.exerciseId !== 'number') throw createError({ statusCode: 400, statusMessage: 'exerciseId обязателен' })
  return addExerciseToDay(db, dayId, {
    exerciseId: body.exerciseId,
    targetSets: body.targetSets ?? null,
    targetReps: body.targetReps ?? null,
  })
})
