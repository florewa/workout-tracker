import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listWorkouts } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listWorkouts(db)
})
