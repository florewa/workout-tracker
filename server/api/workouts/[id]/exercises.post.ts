import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addWorkoutExercise, isWorkoutMember } from '~~/server/services/workouts'
import { broadcastWorkoutChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const workoutId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный id тренировки' })
  }
  const body = await readBody<{ exerciseId?: number }>(event)
  if (!Number.isInteger(body?.exerciseId) || body.exerciseId! <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен exerciseId' })
  }
  if (!(await isWorkoutMember(db, workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }

  const result = await addWorkoutExercise(db, workoutId, body.exerciseId!)
  if (result === 'exercise-not-found') {
    throw createError({ statusCode: 404, statusMessage: 'Упражнение не найдено' })
  }
  if (result === 'added') broadcastWorkoutChanged(workoutId)
  return { added: result === 'added' }
})
