import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { addMember } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ userId: number }>(event)
  if (!Number.isInteger(body?.userId)) throw createError({ statusCode: 400, statusMessage: 'Нужен userId' })
  await addMember(db, id, body.userId)
  return { ok: true }
})
