import { createError, getRouterParam, getQuery } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { prefillValue } from '~~/server/services/defaults'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const userId = Number(getQuery(event).userId)
  if (!Number.isInteger(userId) || userId <= 0) throw createError({ statusCode: 400, statusMessage: 'userId обязателен' })
  return prefillValue(db, userId, id)
})
