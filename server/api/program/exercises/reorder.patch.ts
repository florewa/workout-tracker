import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { reorderProgramExercises } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{ dayId: number; ids: number[] }>(event)
  if (typeof body?.dayId !== 'number' || !Array.isArray(body?.ids) || body.ids.some(n => !Number.isInteger(n))) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны dayId и ids' })
  }
  const ok = await reorderProgramExercises(db, body.dayId, body.ids)
  if (!ok) throw createError({ statusCode: 400, statusMessage: 'Некорректный список упражнений' })
  return { ok: true }
})
