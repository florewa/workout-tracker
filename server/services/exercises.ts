import { and, asc, eq, ilike, isNull } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { exercises } from '~~/server/db/schema'

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
