import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { updateDay } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ code?: string; title?: string; weekday?: number | null }>(event)
  const patch: { code?: string; title?: string; weekday?: number | null } = {}
  if (body?.code !== undefined) {
    if (!body.code.trim()) throw createError({ statusCode: 400, statusMessage: 'Код не может быть пустым' })
    patch.code = body.code
  }
  if (body?.title !== undefined) patch.title = body.title
  if (body?.weekday !== undefined) patch.weekday = body.weekday != null && body.weekday >= 1 && body.weekday <= 7 ? body.weekday : null
  try {
    await updateDay(db, id, patch)
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw createError({ statusCode: 409, statusMessage: 'День с таким кодом уже есть' })
    throw e
  }
  return { ok: true }
})
