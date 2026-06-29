import { and, asc, eq, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { programDays, programExercises, exercises, workouts } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listProgramDays(executor: Executor) {
  return executor
    .select({ id: programDays.id, code: programDays.code, title: programDays.title, order: programDays.order, weekday: programDays.weekday })
    .from(programDays)
    .orderBy(asc(programDays.order))
}

async function dayExercises(executor: Executor, dayId: number) {
  return executor
    .select({
      peId: programExercises.id,
      id: exercises.id,
      name: exercises.name,
      imageUrl: exercises.imageUrl,
      order: programExercises.order,
      targetSets: programExercises.targetSets,
      targetReps: programExercises.targetReps,
    })
    .from(programExercises)
    .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
    .where(eq(programExercises.dayId, dayId))
    .orderBy(asc(programExercises.order))
}

export async function getProgramDay(executor: Executor, code: string) {
  const [day] = await executor.select().from(programDays).where(eq(programDays.code, code)).limit(1)
  if (!day) return null
  const rows = await dayExercises(executor, day.id)
  return { day: { id: day.id, code: day.code, title: day.title, order: day.order, weekday: day.weekday }, exercises: rows }
}

export async function getProgramDayById(executor: Executor, id: number) {
  const [day] = await executor.select().from(programDays).where(eq(programDays.id, id)).limit(1)
  if (!day) return null
  const rows = await dayExercises(executor, day.id)
  return { day: { id: day.id, code: day.code, title: day.title, order: day.order, weekday: day.weekday }, exercises: rows }
}

export async function createDay(executor: Executor, input: { code: string; title: string; weekday: number | null }): Promise<{ id: number }> {
  const [{ maxOrder }] = await executor.select({ maxOrder: sql<number>`coalesce(max(${programDays.order}), 0)`.mapWith(Number) }).from(programDays)
  const code = input.code.trim()
  const [row] = await executor.insert(programDays)
    .values({ code, title: input.title.trim() || code, order: maxOrder + 1, weekday: input.weekday })
    .returning({ id: programDays.id })
  return row
}

export async function updateDay(executor: Executor, id: number, input: { code?: string; title?: string; weekday?: number | null }): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.code !== undefined) patch.code = input.code.trim()
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.weekday !== undefined) patch.weekday = input.weekday
  if (Object.keys(patch).length) await executor.update(programDays).set(patch).where(eq(programDays.id, id))
}

export async function deleteDay(executor: Executor, id: number): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.update(workouts).set({ dayId: null }).where(eq(workouts.dayId, id)) // история тренировок остаётся
    await tx.delete(programExercises).where(eq(programExercises.dayId, id))
    await tx.delete(programDays).where(eq(programDays.id, id))
  })
}

export async function addExerciseToDay(
  executor: Executor,
  dayId: number,
  input: { exerciseId: number; targetSets?: number | null; targetReps?: string | null },
): Promise<{ id: number }> {
  const [{ maxOrder }] = await executor
    .select({ maxOrder: sql<number>`coalesce(max(${programExercises.order}), 0)`.mapWith(Number) })
    .from(programExercises)
    .where(eq(programExercises.dayId, dayId))
  const [row] = await executor.insert(programExercises)
    .values({ dayId, exerciseId: input.exerciseId, order: maxOrder + 1, targetSets: input.targetSets ?? null, targetReps: input.targetReps ?? null })
    .returning({ id: programExercises.id })
  return row
}

export async function updateProgramExercise(executor: Executor, id: number, input: { targetSets?: number | null; targetReps?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.targetSets !== undefined) patch.targetSets = input.targetSets
  if (input.targetReps !== undefined) patch.targetReps = input.targetReps?.toString().trim() || null
  if (Object.keys(patch).length) await executor.update(programExercises).set(patch).where(eq(programExercises.id, id))
}

export async function removeProgramExercise(executor: Executor, id: number): Promise<void> {
  await executor.delete(programExercises).where(eq(programExercises.id, id))
}

// Переупорядочивание упражнений дня (order без unique — пишем напрямую)
export async function reorderProgramExercises(executor: Executor, dayId: number, orderedIds: number[]): Promise<boolean> {
  const rows = await executor.select({ id: programExercises.id }).from(programExercises).where(eq(programExercises.dayId, dayId))
  const set = new Set(rows.map(r => r.id))
  if (orderedIds.length !== set.size || !orderedIds.every(id => set.has(id))) return false
  await executor.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(programExercises).set({ order: i + 1 }).where(and(eq(programExercises.id, orderedIds[i]), eq(programExercises.dayId, dayId)))
    }
  })
  return true
}

export function getDayOwnerForExercise(executor: Executor, peId: number) {
  return executor.select({ dayId: programExercises.dayId }).from(programExercises).where(eq(programExercises.id, peId)).limit(1)
}
