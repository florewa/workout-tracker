import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getProgramDay } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const code = decodeURIComponent(getRouterParam(event, 'code') ?? '')
  const res = await getProgramDay(db, code)
  if (!res) throw createError({ statusCode: 404, statusMessage: 'День программы не найден' })
  return res
})
