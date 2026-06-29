import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { listCategories } from '~~/server/services/categories'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listCategories(db)
})
