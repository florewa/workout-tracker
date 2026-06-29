import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createCategory } from '~~/server/services/categories'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{ name: string }>(event)
  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Название обязательно' })
  return createCategory(db, name)
})
