import { asc, eq } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises } from '~~/server/db/schema'
import { e1rm } from '~~/server/utils/metrics'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export interface ExerciseProgress {
  exerciseId: number
  name: string
  startE1rm: number
  nowE1rm: number
  sessions: number
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** e1RM «Старт → Сейчас» по каждому упражнению пользователя: лучший подход
 *  первого дня против лучшего подхода последнего дня. */
export async function exerciseProgress(executor: Executor, userId: number): Promise<ExerciseProgress[]> {
  const rows = await executor
    .select({
      exerciseId: sets.exerciseId,
      name: exercises.name,
      weight: sets.weight,
      reps: sets.reps,
      createdAt: sets.createdAt,
    })
    .from(sets)
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .where(eq(sets.userId, userId))
    .orderBy(asc(sets.createdAt), asc(sets.id))

  const byExercise = new Map<number, { name: string; rows: typeof rows }>()
  for (const r of rows) {
    let bucket = byExercise.get(r.exerciseId)
    if (!bucket) { bucket = { name: r.name, rows: [] }; byExercise.set(r.exerciseId, bucket) }
    bucket.rows.push(r)
  }

  const result: ExerciseProgress[] = []
  for (const [exerciseId, { name, rows: exRows }] of byExercise) {
    const firstDay = dayKey(exRows[0].createdAt)
    const lastDay = dayKey(exRows[exRows.length - 1].createdAt)
    const bestOn = (day: string) =>
      Math.max(...exRows.filter(r => dayKey(r.createdAt) === day).map(r => e1rm(r.weight, r.reps)))
    const sessions = new Set(exRows.map(r => dayKey(r.createdAt))).size
    result.push({ exerciseId, name, startE1rm: bestOn(firstDay), nowE1rm: bestOn(lastDay), sessions })
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
