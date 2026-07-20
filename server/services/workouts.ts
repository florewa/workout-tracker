import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, notExists, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import {
  workouts, workoutMembers, workoutInvites, workoutExtraExercises, sets, users, exercises,
  programDays, programExercises, exerciseVariations,
} from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function addMember(executor: Executor, workoutId: number, userId: number): Promise<void> {
  await executor.insert(workoutMembers).values({ workoutId, userId }).onConflictDoNothing()
}

export async function addWorkoutExercise(
  executor: Executor,
  workoutId: number,
  exerciseId: number,
): Promise<'added' | 'exists' | 'exercise-not-found'> {
  const [exercise, planned] = await Promise.all([
    executor
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, exerciseId), eq(exercises.isArchived, false), isNull(exercises.aliasOf)))
      .limit(1),
    executor
      .select({ id: programExercises.id })
      .from(workouts)
      .innerJoin(programExercises, eq(programExercises.dayId, workouts.dayId))
      .where(and(eq(workouts.id, workoutId), eq(programExercises.exerciseId, exerciseId)))
      .limit(1),
  ])
  if (!exercise.length) return 'exercise-not-found'
  if (planned.length) return 'exists'

  const [maxOrder] = await executor
    .select({ value: sql<number>`coalesce(max(${workoutExtraExercises.order}), 0)`.mapWith(Number) })
    .from(workoutExtraExercises)
    .where(eq(workoutExtraExercises.workoutId, workoutId))
  const inserted = await executor
    .insert(workoutExtraExercises)
    .values({ workoutId, exerciseId, order: (maxOrder?.value ?? 0) + 1 })
    .onConflictDoNothing()
    .returning({ exerciseId: workoutExtraExercises.exerciseId })
  return inserted.length ? 'added' : 'exists'
}

export async function removeWorkoutExercise(
  executor: Executor,
  workoutId: number,
  exerciseId: number,
): Promise<'removed' | 'not-found' | 'has-sets'> {
  const [extra] = await executor
    .select({ exerciseId: workoutExtraExercises.exerciseId })
    .from(workoutExtraExercises)
    .where(and(
      eq(workoutExtraExercises.workoutId, workoutId),
      eq(workoutExtraExercises.exerciseId, exerciseId),
    ))
    .limit(1)
  if (!extra) return 'not-found'

  const [usage] = await executor
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(sets)
    .leftJoin(exerciseVariations, eq(exerciseVariations.id, sets.variationId))
    .where(and(
      eq(sets.workoutId, workoutId),
      sql`(${sets.exerciseId} = ${exerciseId} or ${exerciseVariations.exerciseId} = ${exerciseId})`,
    ))
  if ((usage?.count ?? 0) > 0) return 'has-sets'

  await executor.delete(workoutExtraExercises).where(and(
    eq(workoutExtraExercises.workoutId, workoutId),
    eq(workoutExtraExercises.exerciseId, exerciseId),
  ))
  return 'removed'
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
      isNull(workouts.deletedAt),
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
        isNull(workouts.deletedAt),
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
      startedAt: workouts.startedAt,
      finishedAt: workouts.finishedAt,
      memberCount: sql<number>`count(distinct ${workoutMembers.userId})`.mapWith(Number),
      setCount: sql<number>`count(distinct ${sets.id})`.mapWith(Number),
    })
    .from(workouts)
    .leftJoin(workoutMembers, eq(workoutMembers.workoutId, workouts.id))
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .leftJoin(programDays, eq(programDays.id, workouts.dayId))
    .where(and(own, isNull(workouts.deletedAt)))
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
      isNull(workouts.deletedAt),
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

export async function isWorkoutMember(
  executor: Executor,
  workoutId: number,
  userId: number,
  includeDeleted = false,
): Promise<boolean> {
  const [row] = await executor
    .select({ userId: workoutMembers.userId })
    .from(workoutMembers)
    .innerJoin(workouts, eq(workouts.id, workoutMembers.workoutId))
    .where(and(
      eq(workoutMembers.workoutId, workoutId),
      eq(workoutMembers.userId, userId),
      includeDeleted ? undefined : isNull(workouts.deletedAt),
    ))
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
  await executor.update(workouts).set({ finishedAt: new Date() }).where(and(eq(workouts.id, id), isNull(workouts.deletedAt)))
}

export async function changeWorkoutDay(executor: Executor, id: number, dayId: number): Promise<boolean> {
  const rows = await executor
    .update(workouts)
    .set({ dayId })
    .where(and(
      eq(workouts.id, id),
      isNull(workouts.finishedAt),
      isNull(workouts.deletedAt),
    ))
    .returning({ id: workouts.id })
  return rows.length > 0
}

export async function trashWorkout(executor: Executor, id: number): Promise<boolean> {
  const rows = await executor
    .update(workouts)
    .set({ deletedAt: new Date() })
    .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)))
    .returning({ id: workouts.id })
  return rows.length > 0
}

export async function restoreWorkout(executor: Executor, id: number): Promise<boolean> {
  const rows = await executor
    .update(workouts)
    .set({ deletedAt: null })
    .where(and(
      eq(workouts.id, id),
      isNotNull(workouts.deletedAt),
      gt(workouts.deletedAt, sql`now() - interval '7 days'`),
    ))
    .returning({ id: workouts.id })
  return rows.length > 0
}

export async function listDeletedWorkouts(executor: Executor, userId: number) {
  return executor
    .select({
      id: workouts.id,
      date: workouts.date,
      dayCode: programDays.code,
      deletedAt: workouts.deletedAt,
      expiresAt: sql<Date>`${workouts.deletedAt} + interval '7 days'`,
      setCount: sql<number>`count(distinct ${sets.id})`.mapWith(Number),
    })
    .from(workouts)
    .innerJoin(workoutMembers, and(
      eq(workoutMembers.workoutId, workouts.id),
      eq(workoutMembers.userId, userId),
    ))
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .leftJoin(programDays, eq(programDays.id, workouts.dayId))
    .where(and(
      isNotNull(workouts.deletedAt),
      gt(workouts.deletedAt, sql`now() - interval '7 days'`),
    ))
    .groupBy(workouts.id, programDays.code)
    .orderBy(desc(workouts.deletedAt))
}

export async function purgeExpiredWorkouts(executor: Executor): Promise<number> {
  const expired = await executor
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(isNotNull(workouts.deletedAt), lt(workouts.deletedAt, sql`now() - interval '7 days'`)))
  for (const workout of expired) await deleteWorkout(executor, workout.id)
  return expired.length
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

interface TimedSet {
  id: number
  userId: number
  slotExerciseId: number
  createdAt: Date
}

export interface ExerciseDuration {
  userId: number
  exerciseId: number
  durationSeconds: number
  startedAt: Date
  finishedAt: Date
}

/**
 * Считает время упражнения отдельно для каждого участника по хронологии его подходов.
 * Интервал начинается с первого подхода и заканчивается переходом к следующему
 * упражнению либо завершением тренировки. При возврате к упражнению интервалы
 * суммируются.
 */
export function calculateExerciseDurations(
  rows: TimedSet[],
  workoutFinishedAt: Date | null,
  now = new Date(),
): ExerciseDuration[] {
  const byUser = new Map<number, TimedSet[]>()
  for (const row of rows) {
    const userRows = byUser.get(row.userId) ?? []
    userRows.push(row)
    byUser.set(row.userId, userRows)
  }

  const result = new Map<string, ExerciseDuration>()
  const addInterval = (userId: number, exerciseId: number, startedAt: Date, finishedAt: Date) => {
    const safeFinishedAt = finishedAt < startedAt ? startedAt : finishedAt
    const durationSeconds = Math.max(0, Math.round((safeFinishedAt.getTime() - startedAt.getTime()) / 1000))
    const key = `${userId}:${exerciseId}`
    const existing = result.get(key)
    if (existing) {
      existing.durationSeconds += durationSeconds
      if (startedAt < existing.startedAt) existing.startedAt = startedAt
      if (safeFinishedAt > existing.finishedAt) existing.finishedAt = safeFinishedAt
      return
    }
    result.set(key, { userId, exerciseId, durationSeconds, startedAt, finishedAt: safeFinishedAt })
  }

  for (const [userId, userRows] of byUser) {
    const ordered = [...userRows].sort((a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
    )
    if (!ordered.length) continue

    let exerciseId = ordered[0].slotExerciseId
    let startedAt = ordered[0].createdAt
    for (const row of ordered.slice(1)) {
      if (row.slotExerciseId === exerciseId) continue
      addInterval(userId, exerciseId, startedAt, row.createdAt)
      exerciseId = row.slotExerciseId
      startedAt = row.createdAt
    }
    addInterval(userId, exerciseId, startedAt, workoutFinishedAt ?? now)
  }

  return [...result.values()].sort((a, b) => a.userId - b.userId || a.startedAt.getTime() - b.startedAt.getTime())
}

export async function getWorkout(executor: Executor, id: number) {
  const [w] = await executor.select().from(workouts).where(and(eq(workouts.id, id), isNull(workouts.deletedAt))).limit(1)
  if (!w) return null
  const [members, rows, extraExercises] = await Promise.all([
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
    executor
      .select({
        id: exercises.id,
        name: exercises.name,
        order: workoutExtraExercises.order,
        weightStep: exercises.weightStep,
      })
      .from(workoutExtraExercises)
      .innerJoin(exercises, eq(exercises.id, workoutExtraExercises.exerciseId))
      .where(eq(workoutExtraExercises.workoutId, id))
      .orderBy(workoutExtraExercises.order, workoutExtraExercises.addedAt),
  ])
  return {
    workout: {
      id: w.id,
      date: w.date,
      dayId: w.dayId,
      startedAt: w.startedAt ?? w.date,
      finishedAt: w.finishedAt,
      recordMode: w.recordMode,
    },
    members,
    sets: rows,
    extraExercises,
    exerciseDurations: calculateExerciseDurations(rows, w.finishedAt),
  }
}
