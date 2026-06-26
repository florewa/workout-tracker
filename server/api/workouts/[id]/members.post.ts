import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addMember, getWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ userId: number }>(event)
  if (!Number.isInteger(body?.userId)) throw createError({ statusCode: 400, statusMessage: 'Нужен userId' })
  const existing = await getWorkout(db, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  await addMember(db, id, body.userId)
  return { ok: true }
})
