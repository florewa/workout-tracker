import { and, asc, eq, ilike, isNull } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { exercises, categories } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listExercises(
  executor: Executor,
  opts: { search?: string } = {},
): Promise<{ id: number; name: string }[]> {
  const where = [isNull(exercises.aliasOf), eq(exercises.isArchived, false)]
  if (opts.search && opts.search.trim()) {
    where.push(ilike(exercises.name, `%${opts.search.trim()}%`))
  }
  return executor
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(and(...where))
    .orderBy(asc(exercises.name))
}

export interface ExerciseFull {
  id: number
  name: string
  nameEn: string | null
  muscleGroup: string | null
  categoryId: number | null
  categoryName: string | null
  imageUrl: string | null
}

// Банк: упражнения с категорией и картинкой, с поиском и фильтром по категории
export async function listExercisesFull(
  executor: Executor,
  opts: { search?: string; categoryId?: number } = {},
): Promise<ExerciseFull[]> {
  const where = [isNull(exercises.aliasOf), eq(exercises.isArchived, false)]
  if (opts.search && opts.search.trim()) where.push(ilike(exercises.name, `%${opts.search.trim()}%`))
  if (opts.categoryId) where.push(eq(exercises.categoryId, opts.categoryId))
  return executor
    .select({
      id: exercises.id,
      name: exercises.name,
      nameEn: exercises.nameEn,
      muscleGroup: exercises.muscleGroup,
      categoryId: exercises.categoryId,
      categoryName: categories.name,
      imageUrl: exercises.imageUrl,
    })
    .from(exercises)
    .leftJoin(categories, eq(categories.id, exercises.categoryId))
    .where(and(...where))
    .orderBy(asc(exercises.name))
}

export async function createExercise(
  executor: Executor,
  input: { name: string; categoryId?: number | null; muscleGroup?: string | null },
): Promise<{ id: number }> {
  const [row] = await executor.insert(exercises).values({
    name: input.name.trim(),
    categoryId: input.categoryId ?? null,
    muscleGroup: input.muscleGroup?.trim() || null,
  }).returning({ id: exercises.id })
  return row
}

export async function updateExercise(
  executor: Executor,
  id: number,
  input: { name?: string; categoryId?: number | null; muscleGroup?: string | null; imageUrl?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  if (input.muscleGroup !== undefined) patch.muscleGroup = input.muscleGroup?.trim() || null
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl
  if (Object.keys(patch).length) await executor.update(exercises).set(patch).where(eq(exercises.id, id))
}

// Мягкое удаление — подходы ссылаются на упражнение, поэтому архивируем
export async function archiveExercise(executor: Executor, id: number): Promise<void> {
  await executor.update(exercises).set({ isArchived: true }).where(eq(exercises.id, id))
}

export async function setExerciseImage(executor: Executor, id: number, imageUrl: string | null): Promise<void> {
  await executor.update(exercises).set({ imageUrl }).where(eq(exercises.id, id))
}
