import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listProgramDays } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listProgramDays(db)
})
