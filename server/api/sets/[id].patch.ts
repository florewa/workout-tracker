import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getSetOwnership, updateSet } from '~~/server/services/sets'
import { isWorkoutMember } from '~~/server/services/workouts'
import { broadcastSetsChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })

  const body = await readBody<{ weight: number; reps: number }>(event)
  for (const key of ['weight', 'reps'] as const) {
    if (typeof body?.[key] !== 'number' || body[key] < 0) {
      throw createError({ statusCode: 400, statusMessage: `Поле ${key} обязательно` })
    }
  }

  const own = await getSetOwnership(db, id)
  if (!own) throw createError({ statusCode: 404, statusMessage: 'Подход не найден' })
  if (!(await isWorkoutMember(db, own.workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }

  await updateSet(db, id, { weight: body.weight, reps: body.reps })
  broadcastSetsChanged(own.workoutId)
  return { ok: true }
})
