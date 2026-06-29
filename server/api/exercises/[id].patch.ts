import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { updateExercise } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ name?: string; categoryId?: number | null; muscleGroup?: string | null }>(event)
  if (body?.name !== undefined && !body.name.trim()) throw createError({ statusCode: 400, statusMessage: 'Название не может быть пустым' })
  try {
    await updateExercise(db, id, body ?? {})
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw createError({ statusCode: 409, statusMessage: 'Такое упражнение уже есть' })
    throw e
  }
  return { ok: true }
})
