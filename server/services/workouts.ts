import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import {
  workouts, workoutMembers, sets, users, exercises, programDays, exerciseVariations,
} from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function addMember(executor: Executor, workoutId: number, userId: number): Promise<void> {
  await executor.insert(workoutMembers).values({ workoutId, userId }).onConflictDoNothing()
}

export async function createWorkout(
  executor: Executor,
  input: { createdBy: number; dayId?: number | null; memberIds: number[]; date?: Date; recordMode?: 'each' | 'single' },
): Promise<{ id: number }> {
  // executor.transaction корректно работает и на db, и на вложенной tx (savepoint)
  return executor.transaction(async (tx) => {
    const [w] = await tx.insert(workouts)
      .values({ date: input.date ?? new Date(), createdBy: input.createdBy, dayId: input.dayId ?? null, startedAt: new Date(), recordMode: input.recordMode ?? 'each' })
      .returning({ id: workouts.id })
    const ids = new Set<number>([input.createdBy, ...input.memberIds])
    for (const userId of ids) {
      await tx.insert(workoutMembers).values({ workoutId: w.id, userId }).onConflictDoNothing()
    }
    return { id: w.id }
  })
}

export async function listWorkouts(executor: Executor, opts: { limit?: number; memberId?: number } = {}) {
  const own = opts.memberId
    ? inArray(
        workouts.id,
        executor.select({ wid: workoutMembers.workoutId }).from(workoutMembers).where(eq(workoutMembers.userId, opts.memberId)),
      )
    : undefined
  return executor
    .select({
      id: workouts.id,
      date: workouts.date,
      dayId: workouts.dayId,
      dayCode: programDays.code,
      finishedAt: workouts.finishedAt,
      memberCount: sql<number>`count(distinct ${workoutMembers.userId})`.mapWith(Number),
      setCount: sql<number>`count(distinct ${sets.id})`.mapWith(Number),
    })
    .from(workouts)
    .leftJoin(workoutMembers, eq(workoutMembers.workoutId, workouts.id))
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .leftJoin(programDays, eq(programDays.id, workouts.dayId))
    .where(own)
    .groupBy(workouts.id, programDays.code)
    .orderBy(desc(workouts.date))
    .limit(opts.limit ?? 50)
}

export async function getActiveWorkout(
  executor: Executor,
  userId: number,
): Promise<{ id: number; date: Date; dayId: number | null } | null> {
  const [row] = await executor
    .select({ id: workouts.id, date: workouts.date, dayId: workouts.dayId })
    .from(workouts)
    .innerJoin(workoutMembers, eq(workoutMembers.workoutId, workouts.id))
    .where(and(
      eq(workoutMembers.userId, userId),
      isNull(workouts.finishedAt),
      gt(workouts.startedAt, sql`now() - interval '18 hours'`),
    ))
    .orderBy(desc(workouts.startedAt))
    .limit(1)
  return row ?? null
}

export async function isWorkoutMember(executor: Executor, workoutId: number, userId: number): Promise<boolean> {
  const [row] = await executor
    .select({ userId: workoutMembers.userId })
    .from(workoutMembers)
    .where(and(eq(workoutMembers.workoutId, workoutId), eq(workoutMembers.userId, userId)))
    .limit(1)
  return Boolean(row)
}

export async function countWorkoutSets(executor: Executor, workoutId: number): Promise<number> {
  const [row] = await executor
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(sets)
    .where(eq(sets.workoutId, workoutId))
  return row?.n ?? 0
}

export async function finishWorkout(executor: Executor, id: number): Promise<void> {
  await executor.update(workouts).set({ finishedAt: new Date() }).where(eq(workouts.id, id))
}

/** Удаляет тренировку с участниками и подходами */
export async function deleteWorkout(executor: Executor, id: number): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.delete(sets).where(eq(sets.workoutId, id))
    await tx.delete(workoutMembers).where(eq(workoutMembers.workoutId, id))
    await tx.delete(workouts).where(eq(workouts.id, id))
  })
}

/**
 * Отменяет тренировку, только если в ней нет записанных подходов.
 * Счёт и удаление — в одной транзакции, чтобы параллельная запись подхода
 * не была удалена в окне между проверкой и удалением. Возвращает false,
 * если подходы есть (тренировка не тронута).
 */
export async function cancelEmptyWorkout(executor: Executor, id: number): Promise<boolean> {
  return executor.transaction(async (tx) => {
    if (await countWorkoutSets(tx, id) > 0) return false
    await tx.delete(workoutMembers).where(eq(workoutMembers.workoutId, id))
    await tx.delete(workouts).where(eq(workouts.id, id))
    return true
  })
}

export async function getWorkout(executor: Executor, id: number) {
  const [w] = await executor.select().from(workouts).where(eq(workouts.id, id)).limit(1)
  if (!w) return null
  const [members, rows] = await Promise.all([
    executor
      .select({ id: users.id, name: users.name })
      .from(workoutMembers)
      .innerJoin(users, eq(workoutMembers.userId, users.id))
      .where(eq(workoutMembers.workoutId, id)),
    executor
      .select({
        id: sets.id,
        userId: sets.userId,
        exerciseId: sets.exerciseId,
        exerciseName: exercises.name,
        setOrder: sets.setOrder,
        weight: sets.weight,
        reps: sets.reps,
        skipped: sets.skipped,
        variationId: sets.variationId,
        variationName: exerciseVariations.name,
        // слот упражнения в тренировке: у вариации-альтернативы это основное упражнение
        slotExerciseId: sql<number>`coalesce(${exerciseVariations.exerciseId}, ${sets.exerciseId})`.mapWith(Number),
        note: sets.note,
      })
      .from(sets)
      .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
      .leftJoin(exerciseVariations, eq(exerciseVariations.id, sets.variationId))
      .where(eq(sets.workoutId, id))
      .orderBy(sets.exerciseId, sets.setOrder),
  ])
  return { workout: { id: w.id, date: w.date, dayId: w.dayId, finishedAt: w.finishedAt, recordMode: w.recordMode }, members, sets: rows }
}
