import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { updateProgramExercise } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ targetSets?: number | null; targetReps?: string | null }>(event)
  await updateProgramExercise(db, id, body ?? {})
  return { ok: true }
})
