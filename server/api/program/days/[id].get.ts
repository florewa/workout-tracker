import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { getProgramDay, getProgramDayById } from '~~/server/services/program'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const raw = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const asId = Number(raw)
  const res = Number.isInteger(asId) && asId > 0 && String(asId) === raw
    ? await getProgramDayById(db, asId)
    : await getProgramDay(db, raw)
  if (!res) throw createError({ statusCode: 404, statusMessage: 'День программы не найден' })
  return res
})
