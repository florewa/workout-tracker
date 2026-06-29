import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getReminders } from '~~/server/services/reminders'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const remindersEnabled = await getReminders(db, me.id)
  return { ...me, remindersEnabled }
})
