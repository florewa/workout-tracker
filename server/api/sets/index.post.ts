import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addSet } from '~~/server/services/sets'
import { isWorkoutMember } from '~~/server/services/workouts'
import { broadcastSetsChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ workoutId: number; userId: number; exerciseId: number; variationId?: number | null; weight?: number; reps?: number; skipped?: boolean; note?: string }>(event)
  for (const key of ['workoutId', 'userId', 'exerciseId'] as const) {
    if (typeof body?.[key] !== 'number') throw createError({ statusCode: 400, statusMessage: `Поле ${key} обязательно` })
  }
  const skipped = body.skipped === true
  // У пропущенного подхода вес/повторы не обязательны — пишем нули
  if (!skipped) {
    for (const key of ['weight', 'reps'] as const) {
      if (typeof body?.[key] !== 'number') throw createError({ statusCode: 400, statusMessage: `Поле ${key} обязательно` })
    }
  }
  // IDOR: писать может только участник тренировки, и подход — только за её участника
  if (!(await isWorkoutMember(db, body.workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }
  if (!(await isWorkoutMember(db, body.workoutId, body.userId))) {
    throw createError({ statusCode: 400, statusMessage: 'Этот участник не в тренировке' })
  }
  const res = await addSet(db, {
    workoutId: body.workoutId,
    userId: body.userId,
    exerciseId: body.exerciseId,
    variationId: typeof body.variationId === 'number' ? body.variationId : null,
    weight: skipped ? 0 : body.weight!,
    reps: skipped ? 0 : body.reps!,
    skipped,
  })
  broadcastSetsChanged(body.workoutId)
  return res
})
