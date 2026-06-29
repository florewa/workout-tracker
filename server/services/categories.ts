import { asc, eq, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { categories, exercises } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listCategories(executor: Executor): Promise<{ id: number; name: string; order: number }[]> {
  return executor
    .select({ id: categories.id, name: categories.name, order: categories.order })
    .from(categories)
    .orderBy(asc(categories.order), asc(categories.name))
}

export async function createCategory(executor: Executor, name: string): Promise<{ id: number }> {
  const [row] = await executor.insert(categories).values({ name }).returning({ id: categories.id })
  return row
}

export async function updateCategory(executor: Executor, id: number, name: string): Promise<void> {
  await executor.update(categories).set({ name }).where(eq(categories.id, id))
}

// Удаляет только пустую категорию (без упражнений) — защищает встроенные.
// Возвращает false, если в категории есть упражнения.
export async function deleteCategory(executor: Executor, id: number): Promise<boolean> {
  const [{ n }] = await executor
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(exercises)
    .where(eq(exercises.categoryId, id))
  if (n > 0) return false
  await executor.delete(categories).where(eq(categories.id, id))
  return true
}
