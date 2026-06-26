import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getActiveWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return getActiveWorkout(db, user.id)
})
