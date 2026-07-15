import { createError, readMultipartFormData } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getAvatar, setAvatar } from '~~/server/services/users'
import { removeUploadedImage, saveImage } from '~~/server/utils/uploads'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const form = await readMultipartFormData(event)
  const file = form?.find(field => field.name === 'avatar' && field.filename)
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'Файл не передан' })
  if (!file.type || !TYPES.has(file.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Только JPG, PNG или WebP' })
  }
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Файл больше 5 МБ' })

  const previous = await getAvatar(db, me.id)
  const avatarUrl = await saveImage(file.data, file.type)
  await setAvatar(db, me.id, avatarUrl)
  await removeUploadedImage(previous).catch(() => {})
  return { ok: true, avatarUrl }
})
