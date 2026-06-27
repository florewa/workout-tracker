import { createError, readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { acceptInvite } from '~~/server/services/friends'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const body = await readBody<{ token?: string }>(event)
  if (!body?.token || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Нужен token' })
  }
  const inviter = await acceptInvite(db, body.token, me.id)
  if (!inviter) return { ok: false }
  return { ok: true, friend: inviter }
})
