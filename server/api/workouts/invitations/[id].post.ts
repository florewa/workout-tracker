import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { respondToWorkoutInvite } from '~~/server/services/workouts'
import { broadcastWorkoutChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workoutId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный id тренировки' })
  }
  const body = await readBody<{ accept?: boolean }>(event)
  if (typeof body?.accept !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Нужно решение по приглашению' })
  }

  const ok = await respondToWorkoutInvite(db, workoutId, user.id, body.accept)
  if (ok) broadcastWorkoutChanged(workoutId)
  return { ok }
})
