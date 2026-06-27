import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listFriends } from '~~/server/services/friends'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return listFriends(db, me.id)
})
