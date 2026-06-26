import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addSet } from '~~/server/services/sets'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{ workoutId: number; userId: number; exerciseId: number; weight: number; reps: number; note?: string }>(event)
  for (const key of ['workoutId', 'userId', 'exerciseId', 'weight', 'reps'] as const) {
    if (typeof body?.[key] !== 'number') throw createError({ statusCode: 400, statusMessage: `Поле ${key} обязательно` })
  }
  return addSet(db, body)
})
