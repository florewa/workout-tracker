import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function addSet(
  executor: Executor,
  input: { workoutId: number; userId: number; exerciseId: number; variationId?: number | null; weight: number; reps: number; skipped?: boolean; note?: string | null },
): Promise<{ id: number; setOrder: number }> {
  // Гонка двух параллельных записей могла бы выдать одинаковый set_order.
  // Защищает UNIQUE(workout_id, user_id, exercise_id, set_order) + retry с пересчётом.
  for (let attempt = 0; ; attempt++) {
    const [{ maxOrder }] = await executor
      .select({ maxOrder: sql<number>`coalesce(max(${sets.setOrder}), 0)`.mapWith(Number) })
      .from(sets)
      .where(and(
        eq(sets.workoutId, input.workoutId),
        eq(sets.userId, input.userId),
        eq(sets.exerciseId, input.exerciseId),
      ))
    const setOrder = maxOrder + 1
    try {
      const [row] = await executor.insert(sets).values({
        workoutId: input.workoutId,
        userId: input.userId,
        exerciseId: input.exerciseId,
        variationId: input.variationId ?? null,
        setOrder,
        weight: input.weight,
        reps: input.reps,
        skipped: input.skipped ?? false,
        note: input.note ?? null,
      }).returning({ id: sets.id })
      return { id: row.id, setOrder }
    } catch (e) {
      // 23505 — нарушение UNIQUE: порядок уже занят параллельной вставкой, пробуем снова
      if ((e as { code?: string }).code === '23505' && attempt < 5) continue
      throw e
    }
  }
}

export async function getSetOwnership(
  executor: Executor,
  id: number,
): Promise<{ workoutId: number; userId: number } | null> {
  const [row] = await executor
    .select({ workoutId: sets.workoutId, userId: sets.userId })
    .from(sets)
    .where(eq(sets.id, id))
    .limit(1)
  return row ?? null
}

export async function deleteSet(executor: Executor, id: number): Promise<void> {
  await executor.delete(sets).where(eq(sets.id, id))
}

export async function updateSet(
  executor: Executor,
  id: number,
  input: { weight: number; reps: number },
): Promise<void> {
  // Внесение значений снимает признак пропуска — подход становится обычным
  await executor.update(sets).set({ weight: input.weight, reps: input.reps, skipped: false }).where(eq(sets.id, id))
}

// Переупорядочивание подходов одного упражнения участника. orderedIds — полный
// список подходов группы в новом порядке. UNIQUE(workout,user,exercise,set_order)
// не даёт переставлять «в лоб», поэтому пишем в два прохода: сперва во временный
// диапазон, затем в финальные 1..n.
export async function reorderSets(
  executor: Executor,
  orderedIds: number[],
): Promise<{ workoutId: number } | null> {
  if (orderedIds.length === 0) return null
  const rows = await executor
    .select({ id: sets.id, workoutId: sets.workoutId, userId: sets.userId, exerciseId: sets.exerciseId })
    .from(sets)
    .where(inArray(sets.id, orderedIds))
  if (rows.length !== orderedIds.length) return null

  const { workoutId, userId, exerciseId } = rows[0]
  if (rows.some(r => r.workoutId !== workoutId || r.userId !== userId || r.exerciseId !== exerciseId)) return null

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(sets)
    .where(and(eq(sets.workoutId, workoutId), eq(sets.userId, userId), eq(sets.exerciseId, exerciseId)))
  if (total !== orderedIds.length) return null

  const TEMP = 100000
  await executor.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(sets).set({ setOrder: i + 1 + TEMP }).where(eq(sets.id, orderedIds[i]))
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(sets).set({ setOrder: i + 1 }).where(eq(sets.id, orderedIds[i]))
    }
  })
  return { workoutId }
}

export async function lastSet(
  executor: Executor,
  userId: number,
  exerciseId: number,
): Promise<{ weight: number; reps: number } | null> {
  // учитываем алиасы: подходы могли писаться под дубль, указывающий alias_of на этот канон
  const aliasIds = await executor
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.aliasOf, exerciseId))
  const ids = [exerciseId, ...aliasIds.map((r) => r.id)]
  const [row] = await executor
    .select({ weight: sets.weight, reps: sets.reps, variationId: sets.variationId })
    .from(sets)
    .where(and(eq(sets.userId, userId), inArray(sets.exerciseId, ids), eq(sets.skipped, false)))
    .orderBy(desc(sets.createdAt), desc(sets.id))
    .limit(1)
  return row ?? null
}
