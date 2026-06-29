import { readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createWorkout } from '~~/server/services/workouts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ dayId?: number | null; memberIds?: number[]; date?: string; recordMode?: string }>(event)

  let workoutDate: Date | undefined
  if (body?.date) {
    const parsed = new Date(body.date)
    if (!Number.isNaN(parsed.getTime())) workoutDate = parsed
  }

  const recordMode = body?.recordMode === 'single' ? 'single' : 'each'

  return createWorkout(db, {
    createdBy: user.id,
    dayId: body?.dayId ?? null,
    memberIds: Array.isArray(body?.memberIds) ? body.memberIds : [],
    recordMode,
    ...(workoutDate ? { date: workoutDate } : {}),
  })
})
