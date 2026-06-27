import { createError, getRouterParam } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { removeFriend } from '~~/server/services/friends'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const friendId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(friendId) || friendId <= 0) throw createError({ statusCode: 400, statusMessage: 'Неверный id' })
  await removeFriend(db, me.id, friendId)
  return { ok: true }
})
