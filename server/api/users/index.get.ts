import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listUsers } from '~~/server/services/users'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listUsers(db)
})
