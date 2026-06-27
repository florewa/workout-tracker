import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { exerciseProgress } from '~~/server/services/progress'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return exerciseProgress(db, me.id)
})
