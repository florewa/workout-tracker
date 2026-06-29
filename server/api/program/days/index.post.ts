import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createDay } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{ code: string; title?: string; weekday?: number | null }>(event)
  const code = body?.code?.trim()
  if (!code) throw createError({ statusCode: 400, statusMessage: 'Код дня обязателен' })
  const weekday = body.weekday != null && body.weekday >= 1 && body.weekday <= 7 ? body.weekday : null
  try {
    return await createDay(db, { code, title: body.title ?? code, weekday })
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw createError({ statusCode: 409, statusMessage: 'День с таким кодом уже есть' })
    throw e
  }
})
