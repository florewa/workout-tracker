import { asc, eq, inArray, or } from 'drizzle-orm'
import { setHeader } from 'h3'
import { db } from '~~/server/db/client'
import {
  exerciseDefaults, exercises, favoriteExercises, friendships, programDays, sets,
  users, workoutMembers, workoutPlanExercises, workouts,
} from '~~/server/db/schema'
import { requireUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const memberRows = await db.select({ workoutId: workoutMembers.workoutId })
    .from(workoutMembers).where(eq(workoutMembers.userId, me.id))
  const workoutIds = memberRows.map(row => row.workoutId)

  const [profile, friends, favorites, defaults, workoutRows, setRows, plans] = await Promise.all([
    db.select().from(users).where(eq(users.id, me.id)).limit(1),
    db.select({ low: friendships.userLow, high: friendships.userHigh })
      .from(friendships).where(or(eq(friendships.userLow, me.id), eq(friendships.userHigh, me.id))),
    db.select({ exerciseId: favoriteExercises.exerciseId, name: exercises.name })
      .from(favoriteExercises).innerJoin(exercises, eq(exercises.id, favoriteExercises.exerciseId))
      .where(eq(favoriteExercises.userId, me.id)),
    db.select().from(exerciseDefaults).where(eq(exerciseDefaults.userId, me.id)),
    workoutIds.length
      ? db.select({
          id: workouts.id, date: workouts.date, dayCode: programDays.code, note: workouts.note,
          recordMode: workouts.recordMode, startedAt: workouts.startedAt, finishedAt: workouts.finishedAt,
        }).from(workouts).leftJoin(programDays, eq(programDays.id, workouts.dayId))
          .where(inArray(workouts.id, workoutIds)).orderBy(asc(workouts.date))
      : Promise.resolve([]),
    db.select({
      workoutId: sets.workoutId, exerciseId: sets.exerciseId, exerciseName: exercises.name,
      setOrder: sets.setOrder, weight: sets.weight, reps: sets.reps, skipped: sets.skipped,
      note: sets.note, createdAt: sets.createdAt,
    }).from(sets).innerJoin(exercises, eq(exercises.id, sets.exerciseId))
      .where(eq(sets.userId, me.id)).orderBy(asc(sets.createdAt)),
    workoutIds.length
      ? db.select().from(workoutPlanExercises).where(inArray(workoutPlanExercises.workoutId, workoutIds))
      : Promise.resolve([]),
  ])

  const friendIds = friends.map(row => row.low === me.id ? row.high : row.low)
  const friendProfiles = friendIds.length
    ? await db.select({ id: users.id, name: users.name, username: users.username })
        .from(users).where(inArray(users.id, friendIds))
    : []
  const exportedAt = new Date().toISOString()
  setHeader(event, 'content-disposition', `attachment; filename="workout-data-${exportedAt.slice(0, 10)}.json"`)
  setHeader(event, 'cache-control', 'no-store')
  return {
    format: 'workout-tracker-user-export', version: 1, exportedAt,
    profile: profile[0] ?? null,
    friends: friendProfiles,
    favorites,
    defaults,
    workouts: workoutRows,
    workoutPlans: plans,
    sets: setRows,
  }
})
