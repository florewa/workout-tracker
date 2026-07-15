import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listWeeklySchedule } from '~~/server/services/schedule'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listWeeklySchedule(db)
})
