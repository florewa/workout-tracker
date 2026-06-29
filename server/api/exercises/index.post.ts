import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createExercise } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{ name: string; categoryId?: number | null; muscleGroup?: string | null }>(event)
  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Название обязательно' })
  try {
    return await createExercise(db, { name, categoryId: body.categoryId ?? null, muscleGroup: body.muscleGroup ?? null })
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw createError({ statusCode: 409, statusMessage: 'Такое упражнение уже есть' })
    throw e
  }
})
