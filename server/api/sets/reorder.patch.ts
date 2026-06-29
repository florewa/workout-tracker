import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getSetOwnership, reorderSets } from '~~/server/services/sets'
import { isWorkoutMember } from '~~/server/services/workouts'
import { broadcastSetsChanged } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ ids: number[] }>(event)
  if (!Array.isArray(body?.ids) || body.ids.length === 0 || body.ids.some(n => !Number.isInteger(n) || n <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен непустой список ids' })
  }

  const own = await getSetOwnership(db, body.ids[0])
  if (!own) throw createError({ statusCode: 404, statusMessage: 'Подход не найден' })
  if (!(await isWorkoutMember(db, own.workoutId, me.id))) {
    throw createError({ statusCode: 403, statusMessage: 'Нет доступа к тренировке' })
  }

  const res = await reorderSets(db, body.ids)
  if (!res) throw createError({ statusCode: 400, statusMessage: 'Некорректный список подходов' })
  broadcastSetsChanged(res.workoutId)
  return { ok: true }
})
