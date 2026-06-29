import { and, asc, eq, ne, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { exerciseVariations, sets } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listVariations(executor: Executor, exerciseId: number): Promise<{ id: number; name: string; isDefault: boolean }[]> {
  return executor
    .select({ id: exerciseVariations.id, name: exerciseVariations.name, isDefault: exerciseVariations.isDefault })
    .from(exerciseVariations)
    .where(eq(exerciseVariations.exerciseId, exerciseId))
    .orderBy(asc(exerciseVariations.id))
}

export async function addVariation(executor: Executor, exerciseId: number, name: string): Promise<{ id: number }> {
  return executor.transaction(async (tx) => {
    const [{ cnt }] = await tx
      .select({ cnt: sql<number>`count(*)`.mapWith(Number) })
      .from(exerciseVariations)
      .where(eq(exerciseVariations.exerciseId, exerciseId))
    const [row] = await tx.insert(exerciseVariations)
      .values({ exerciseId, name: name.trim(), isDefault: cnt === 0 }) // первая вариация — дефолтная
      .returning({ id: exerciseVariations.id })
    return row
  })
}

export async function updateVariation(executor: Executor, id: number, name: string): Promise<void> {
  await executor.update(exerciseVariations).set({ name: name.trim() }).where(eq(exerciseVariations.id, id))
}

export async function setDefaultVariation(executor: Executor, exerciseId: number, variationId: number): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.update(exerciseVariations).set({ isDefault: false }).where(and(eq(exerciseVariations.exerciseId, exerciseId), ne(exerciseVariations.id, variationId)))
    await tx.update(exerciseVariations).set({ isDefault: true }).where(eq(exerciseVariations.id, variationId))
  })
}

export async function deleteVariation(executor: Executor, id: number): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.update(sets).set({ variationId: null }).where(eq(sets.variationId, id))
    await tx.delete(exerciseVariations).where(eq(exerciseVariations.id, id))
  })
}

export function getVariationExercise(executor: Executor, id: number) {
  return executor.select({ exerciseId: exerciseVariations.exerciseId }).from(exerciseVariations).where(eq(exerciseVariations.id, id)).limit(1)
}
