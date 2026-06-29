import { and, eq } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { exerciseDefaults } from '~~/server/db/schema'
import { lastSet } from '~~/server/services/sets'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function getDefaultsForExercise(executor: Executor, exerciseId: number): Promise<{ userId: number; weight: number; reps: number }[]> {
  return executor
    .select({ userId: exerciseDefaults.userId, weight: exerciseDefaults.weight, reps: exerciseDefaults.reps })
    .from(exerciseDefaults)
    .where(eq(exerciseDefaults.exerciseId, exerciseId))
}

export async function getDefault(executor: Executor, userId: number, exerciseId: number): Promise<{ weight: number; reps: number } | null> {
  const [row] = await executor
    .select({ weight: exerciseDefaults.weight, reps: exerciseDefaults.reps })
    .from(exerciseDefaults)
    .where(and(eq(exerciseDefaults.userId, userId), eq(exerciseDefaults.exerciseId, exerciseId)))
    .limit(1)
  return row ?? null
}

export async function setDefault(executor: Executor, userId: number, exerciseId: number, weight: number, reps: number): Promise<void> {
  await executor.insert(exerciseDefaults)
    .values({ userId, exerciseId, weight, reps })
    .onConflictDoUpdate({ target: [exerciseDefaults.userId, exerciseDefaults.exerciseId], set: { weight, reps } })
}

// Подстановка при записи: последний реальный подход → база → ничего
export async function prefillValue(
  executor: Executor,
  userId: number,
  exerciseId: number,
): Promise<{ weight: number; reps: number; source: 'last' | 'default' } | null> {
  const last = await lastSet(executor, userId, exerciseId)
  if (last) return { ...last, source: 'last' }
  const def = await getDefault(executor, userId, exerciseId)
  if (def) return { ...def, source: 'default' }
  return null
}
