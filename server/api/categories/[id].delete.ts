import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { deleteCategory } from '~~/server/services/categories'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const ok = await deleteCategory(db, id)
  if (!ok) throw createError({ statusCode: 409, statusMessage: 'В категории есть упражнения' })
  return { ok: true }
})
