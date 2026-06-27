import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getOrCreateInviteToken } from '~~/server/services/friends'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const token = await getOrCreateInviteToken(db, me.id)
  const bot = process.env.BOT_USERNAME ?? ''
  const link = bot ? `https://t.me/${bot}?startapp=${token}` : ''
  return { token, link }
})
