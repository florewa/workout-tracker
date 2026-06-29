import { createError, getRouterParam, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { updateVariation, setDefaultVariation, getVariationExercise } from '~~/server/services/variations'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const body = await readBody<{ name?: string; makeDefault?: boolean }>(event)
  if (body?.name !== undefined) {
    if (!body.name.trim()) throw createError({ statusCode: 400, statusMessage: 'Название не может быть пустым' })
    await updateVariation(db, id, body.name)
  }
  if (body?.makeDefault) {
    const [v] = await getVariationExercise(db, id)
    if (!v) throw createError({ statusCode: 404, statusMessage: 'Вариация не найдена' })
    await setDefaultVariation(db, v.exerciseId, id)
  }
  return { ok: true }
})
