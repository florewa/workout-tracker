import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const res = await getWorkout(db, id)
  if (!res) throw createError({ statusCode: 404, statusMessage: 'Тренировка не найдена' })
  return res
})
