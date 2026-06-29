import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { setExerciseImage } from '~~/server/services/exercises'
import { saveImage, isAllowedImageType } from '~~/server/utils/uploads'

const MAX_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })

  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'image' && f.filename)
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'Файл не передан' })
  if (!isAllowedImageType(file.type)) throw createError({ statusCode: 400, statusMessage: 'Только jpg/png/webp/gif' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Файл больше 5 МБ' })

  const url = await saveImage(file.data, file.type!)
  await setExerciseImage(db, id, url)
  return { ok: true, imageUrl: url }
})
