import { and, asc, eq } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { exercises, favoriteExercises } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

async function canonicalExerciseId(executor: Executor, exerciseId: number): Promise<number | null> {
  const [exercise] = await executor
    .select({ id: exercises.id, aliasOf: exercises.aliasOf, isArchived: exercises.isArchived })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1)

  if (!exercise || exercise.isArchived) return null
  return exercise.aliasOf ?? exercise.id
}

export async function listFavoriteExercises(executor: Executor, userId: number) {
  return executor
    .select({ exerciseId: favoriteExercises.exerciseId, name: exercises.name })
    .from(favoriteExercises)
    .innerJoin(exercises, eq(exercises.id, favoriteExercises.exerciseId))
    .where(eq(favoriteExercises.userId, userId))
    .orderBy(asc(favoriteExercises.createdAt), asc(exercises.name))
}

export async function setExerciseFavorite(
  executor: Executor,
  userId: number,
  exerciseId: number,
  favorite: boolean,
): Promise<{ exerciseId: number; favorite: boolean } | null> {
  const canonicalId = await canonicalExerciseId(executor, exerciseId)
  if (canonicalId == null) return null

  if (favorite) {
    await executor
      .insert(favoriteExercises)
      .values({ userId, exerciseId: canonicalId })
      .onConflictDoNothing()
  } else {
    await executor
      .delete(favoriteExercises)
      .where(and(
        eq(favoriteExercises.userId, userId),
        eq(favoriteExercises.exerciseId, canonicalId),
      ))
  }

  return { exerciseId: canonicalId, favorite }
}
