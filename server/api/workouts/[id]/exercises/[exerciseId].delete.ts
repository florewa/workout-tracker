import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { isWorkoutMember, removeWorkoutExercise } from '~~/server/services/workouts'
import { broadcastWorkoutChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const workoutId = Number(getRouterParam(event, 'id'))
  const exerciseId = Number(getRouterParam(event, 'exerciseId'))
  if (!Number.isInteger(workoutId) || workoutId <= 0 || !Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  }
  if (!(await isWorkoutMember(db, workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }

  const result = await removeWorkoutExercise(db, workoutId, exerciseId)
  if (result === 'not-found') {
    throw createError({ statusCode: 404, statusMessage: 'Дополнительное упражнение не найдено' })
  }
  if (result === 'has-sets') {
    throw createError({ statusCode: 409, statusMessage: 'Сначала удали записанные подходы этого упражнения' })
  }
  broadcastWorkoutChanged(workoutId)
  return { removed: true }
})
