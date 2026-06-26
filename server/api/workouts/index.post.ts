import { readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ dayId?: number | null; memberIds?: number[] }>(event)
  return createWorkout(db, {
    createdBy: user.id,
    dayId: body?.dayId ?? null,
    memberIds: Array.isArray(body?.memberIds) ? body.memberIds : [],
  })
})
