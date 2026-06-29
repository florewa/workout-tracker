import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { archiveExercise } from '~~/server/services/exercises'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  // мягкое удаление: подходы ссылаются на упражнение
  await archiveExercise(db, id)
  return { ok: true }
})
