import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listDeletedWorkouts, purgeExpiredWorkouts } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  await purgeExpiredWorkouts(db)
  return listDeletedWorkouts(db, me.id)
})
