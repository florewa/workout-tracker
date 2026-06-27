import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addSet } from '~~/server/services/sets'
import { isWorkoutMember } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ workoutId: number; userId: number; exerciseId: number; weight: number; reps: number; note?: string }>(event)
  for (const key of ['workoutId', 'userId', 'exerciseId', 'weight', 'reps'] as const) {
    if (typeof body?.[key] !== 'number') throw createError({ statusCode: 400, statusMessage: `Поле ${key} обязательно` })
  }
  // IDOR: писать может только участник тренировки, и подход — только за её участника
  if (!(await isWorkoutMember(db, body.workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }
  if (!(await isWorkoutMember(db, body.workoutId, body.userId))) {
    throw createError({ statusCode: 400, statusMessage: 'Этот участник не в тренировке' })
  }
  return addSet(db, body)
})
