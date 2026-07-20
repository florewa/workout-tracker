import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { deleteUserAccount, getAvatar } from '~~/server/services/users'
import { removeUploadedImage } from '~~/server/utils/uploads'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ confirmation?: string }>(event)
  if (body?.confirmation !== 'УДАЛИТЬ') {
    throw createError({ statusCode: 400, statusMessage: 'Для подтверждения введи УДАЛИТЬ' })
  }
  const avatarUrl = await getAvatar(db, me.id)
  await deleteUserAccount(db, me.id)
  await removeUploadedImage(avatarUrl).catch(() => {})
  return { deleted: true }
})
