import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getAvatar, setAvatar } from '~~/server/services/users'
import { removeUploadedImage } from '~~/server/utils/uploads'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const previous = await getAvatar(db, me.id)
  await setAvatar(db, me.id, null)
  await removeUploadedImage(previous).catch(() => {})
  return { ok: true }
})
