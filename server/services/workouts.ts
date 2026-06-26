import { desc, eq, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import {
  workouts, workoutMembers, sets, users, exercises,
} from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function addMember(executor: Executor, workoutId: number, userId: number): Promise<void> {
  await executor.insert(workoutMembers).values({ workoutId, userId }).onConflictDoNothing()
}

export async function createWorkout(
  executor: Executor,
  input: { createdBy: number; dayId?: number | null; memberIds: number[]; date?: Date },
): Promise<{ id: number }> {
  // executor.transaction корректно работает и на db, и на вложенной tx (savepoint)
  return executor.transaction(async (tx) => {
    const [w] = await tx.insert(workouts)
      .values({ date: input.date ?? new Date(), createdBy: input.createdBy, dayId: input.dayId ?? null, startedAt: new Date() })
      .returning({ id: workouts.id })
    const ids = new Set<number>([input.createdBy, ...input.memberIds])
    for (const userId of ids) {
      await tx.insert(workoutMembers).values({ workoutId: w.id, userId }).onConflictDoNothing()
    }
    return { id: w.id }
  })
}

export async function listWorkouts(executor: Executor, opts: { limit?: number } = {}) {
  return executor
    .select({
      id: workouts.id,
      date: workouts.date,
      dayId: workouts.dayId,
      memberCount: sql<number>`count(${workoutMembers.userId})`.mapWith(Number),
    })
    .from(workouts)
    .leftJoin(workoutMembers, eq(workoutMembers.workoutId, workouts.id))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.date))
    .limit(opts.limit ?? 50)
}

export async function getWorkout(executor: Executor, id: number) {
  const [w] = await executor.select().from(workouts).where(eq(workouts.id, id)).limit(1)
  if (!w) return null
  const members = await executor
    .select({ id: users.id, name: users.name })
    .from(workoutMembers)
    .innerJoin(users, eq(workoutMembers.userId, users.id))
    .where(eq(workoutMembers.workoutId, id))
  const rows = await executor
    .select({
      id: sets.id,
      userId: sets.userId,
      exerciseId: sets.exerciseId,
      exerciseName: exercises.name,
      setOrder: sets.setOrder,
      weight: sets.weight,
      reps: sets.reps,
      note: sets.note,
    })
    .from(sets)
    .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
    .where(eq(sets.workoutId, id))
    .orderBy(sets.exerciseId, sets.setOrder)
  return { workout: { id: w.id, date: w.date, dayId: w.dayId }, members, sets: rows }
}
