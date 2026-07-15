import { and, desc, eq, gt, inArray, isNull, notExists, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import {
  workouts, workoutMembers, workoutInvites, sets, users, exercises, programDays, exerciseVariations,
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
    if ((input.recordMode ?? 'each') === 'each') {
      const invitedIds = [...ids].filter(userId => userId !== input.createdBy)
      if (invitedIds.length) {
        await tx.insert(workoutInvites).values(
          invitedIds.map(userId => ({ workoutId: w.id, userId })),
        ).onConflictDoNothing()
      }
    }
    return { id: w.id }
  })
}

export async function listPendingWorkoutInvites(executor: Executor, userId: number) {
  return executor
    .select({
      workoutId: workoutInvites.workoutId,
      inviterId: users.id,
      inviterName: users.name,
      dayCode: programDays.code,
      createdAt: workoutInvites.createdAt,
    })
    .from(workoutInvites)
    .innerJoin(workouts, eq(workouts.id, workoutInvites.workoutId))
    .innerJoin(users, eq(users.id, workouts.createdBy))
    .leftJoin(programDays, eq(programDays.id, workouts.dayId))
    .where(and(
      eq(workoutInvites.userId, userId),
      eq(workoutInvites.status, 'pending'),
      isNull(workouts.finishedAt),
      gt(workouts.startedAt, sql`now() - interval '18 hours'`),
    ))
    .orderBy(desc(workoutInvites.createdAt))
}

export async function getWorkoutInviteRecipients(executor: Executor, workoutId: number) {
  const rows = await executor
    .select({ userId: users.id, name: users.name, telegramId: users.telegramId })
    .from(workoutInvites)
    .innerJoin(users, eq(users.id, workoutInvites.userId))
    .where(and(eq(workoutInvites.workoutId, workoutId), eq(workoutInvites.status, 'pending')))
  return rows.filter((row): row is { userId: number; name: string; telegramId: number } => row.telegramId != null)
}

export async function respondToWorkoutInvite(
  executor: Executor,
  workoutId: number,
  userId: number,
  accept: boolean,
): Promise<boolean> {
  return executor.transaction(async (tx) => {
    const [invite] = await tx
      .select({ status: workoutInvites.status })
      .from(workoutInvites)
      .innerJoin(workouts, eq(workouts.id, workoutInvites.workoutId))
      .where(and(
        eq(workoutInvites.workoutId, workoutId),
        eq(workoutInvites.userId, userId),
        isNull(workouts.finishedAt),
        gt(workouts.startedAt, sql`now() - interval '18 hours'`),
      ))
      .limit(1)

    if (!invite) return false
    if (invite.status === 'accepted') return accept
    if (invite.status !== 'pending') return false

    await tx.update(workoutInvites)
      .set({ status: accept ? 'accepted' : 'declined', respondedAt: new Date() })
      .where(and(
        eq(workoutInvites.workoutId, workoutId),
        eq(workoutInvites.userId, userId),
        eq(workoutInvites.status, 'pending'),
      ))

    if (!accept) {
      await tx.delete(workoutMembers).where(and(
        eq(workoutMembers.workoutId, workoutId),
        eq(workoutMembers.userId, userId),
      ))
    }
    return true
  })
}

export async function listWorkouts(executor: Executor, opts: { limit?: number; memberId?: number } = {}) {
  const own = opts.memberId
    ? inArray(
        workouts.id,
        executor.select({ wid: workoutMembers.workoutId })
          .from(workoutMembers)
          .where(and(
            eq(workoutMembers.userId, opts.memberId),
            notExists(
              executor.select({ workoutId: workoutInvites.workoutId })
                .from(workoutInvites)
                .where(and(
                  eq(workoutInvites.workoutId, workoutMembers.workoutId),
                  eq(workoutInvites.userId, opts.memberId),
                  eq(workoutInvites.status, 'pending'),
                )),
            ),
          )),
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
      notExists(
        executor.select({ workoutId: workoutInvites.workoutId })
          .from(workoutInvites)
          .where(and(
            eq(workoutInvites.workoutId, workouts.id),
            eq(workoutInvites.userId, userId),
            eq(workoutInvites.status, 'pending'),
          )),
      ),
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
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
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
        createdAt: sets.createdAt,
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
