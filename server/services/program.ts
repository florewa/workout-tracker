import { asc, eq } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { programDays, programExercises, exercises } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listProgramDays(executor: Executor) {
  return executor
    .select({ id: programDays.id, code: programDays.code, title: programDays.title, order: programDays.order })
    .from(programDays)
    .orderBy(asc(programDays.order))
}

export async function getProgramDay(executor: Executor, code: string) {
  const [day] = await executor.select().from(programDays).where(eq(programDays.code, code)).limit(1)
  if (!day) return null
  const rows = await executor
    .select({
      id: exercises.id,
      name: exercises.name,
      order: programExercises.order,
      targetSets: programExercises.targetSets,
      targetReps: programExercises.targetReps,
    })
    .from(programExercises)
    .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
    .where(eq(programExercises.dayId, day.id))
    .orderBy(asc(programExercises.order))
  return { day: { id: day.id, code: day.code, title: day.title, order: day.order }, exercises: rows }
}
