import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { archiveExercise, exerciseSource } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  const src = await exerciseSource(db, id)
  if (src === undefined) throw createError({ statusCode: 404, statusMessage: 'Не найдено' })
  if (src) throw createError({ statusCode: 403, statusMessage: 'Встроенное упражнение нельзя удалить' })
  // мягкое удаление: подходы ссылаются на упражнение
  await archiveExercise(db, id)
  return { ok: true }
})
