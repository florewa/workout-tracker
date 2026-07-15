import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listPendingWorkoutInvites } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listPendingWorkoutInvites(db, user.id)
})
