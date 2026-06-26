import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function addSet(
  executor: Executor,
  input: { workoutId: number; userId: number; exerciseId: number; weight: number; reps: number; note?: string | null },
): Promise<{ id: number; setOrder: number }> {
  const [{ maxOrder }] = await executor
    .select({ maxOrder: sql<number>`coalesce(max(${sets.setOrder}), 0)`.mapWith(Number) })
    .from(sets)
    .where(and(
      eq(sets.workoutId, input.workoutId),
      eq(sets.userId, input.userId),
      eq(sets.exerciseId, input.exerciseId),
    ))
  const setOrder = maxOrder + 1
  const [row] = await executor.insert(sets).values({
    workoutId: input.workoutId,
    userId: input.userId,
    exerciseId: input.exerciseId,
    setOrder,
    weight: input.weight,
    reps: input.reps,
    note: input.note ?? null,
  }).returning({ id: sets.id })
  return { id: row.id, setOrder }
}

export async function deleteSet(executor: Executor, id: number): Promise<void> {
  await executor.delete(sets).where(eq(sets.id, id))
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
    .select({ weight: sets.weight, reps: sets.reps })
    .from(sets)
    .where(and(eq(sets.userId, userId), inArray(sets.exerciseId, ids)))
    .orderBy(desc(sets.createdAt), desc(sets.id))
    .limit(1)
  return row ?? null
}
