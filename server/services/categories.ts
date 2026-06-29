import { asc, eq } from 'drizzle-orm'
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

// Удаляет категорию, открепляя от неё упражнения (упражнения остаются)
export async function deleteCategory(executor: Executor, id: number): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.update(exercises).set({ categoryId: null }).where(eq(exercises.categoryId, id))
    await tx.delete(categories).where(eq(categories.id, id))
  })
}
