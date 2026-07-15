import { readBody } from 'h3'
import { db } from '~~/server/db/client'
import { requireUser } from '~~/server/utils/auth'
import { createWorkout, getWorkoutInviteRecipients } from '~~/server/services/workouts'
import { sendWorkoutInvitation } from '~~/server/utils/telegram-send'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ dayId?: number | null; memberIds?: number[]; date?: string; recordMode?: string }>(event)

  let workoutDate: Date | undefined
  if (body?.date) {
    const parsed = new Date(body.date)
    if (!Number.isNaN(parsed.getTime())) workoutDate = parsed
  }

  const recordMode = body?.recordMode === 'single' ? 'single' : 'each'

  const workout = await createWorkout(db, {
    createdBy: user.id,
    dayId: body?.dayId ?? null,
    memberIds: Array.isArray(body?.memberIds) ? body.memberIds : [],
    recordMode,
    ...(workoutDate ? { date: workoutDate } : {}),
  })

  const token = process.env.BOT_TOKEN
  if (token && recordMode === 'each') {
    const recipients = await getWorkoutInviteRecipients(db, workout.id)
    await Promise.all(recipients.map(recipient => sendWorkoutInvitation(token, {
      chatId: recipient.telegramId,
      inviterName: user.name,
      workoutId: workout.id,
    })))
  }

  return workout
})
