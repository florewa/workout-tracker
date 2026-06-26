import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  return requireUser(event)
})
