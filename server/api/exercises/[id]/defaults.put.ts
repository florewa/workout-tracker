import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { setDefault } from '~~/server/services/defaults'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ userId: number; weight: number; reps: number }>(event)
  if (typeof body?.userId !== 'number' || typeof body?.weight !== 'number' || typeof body?.reps !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'userId, weight, reps обязательны' })
  }
  await setDefault(db, body.userId, id, Math.max(0, body.weight), Math.max(0, Math.round(body.reps)))
  return { ok: true }
})
