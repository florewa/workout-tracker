import { asc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises } from '~~/server/db/schema'
import { e1rm, tonnage } from '~~/server/utils/metrics'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export interface ProgressPoint {
  date: string
  e1rm: number
  volume: number
}

export interface ExerciseProgress {
  exerciseId: number
  name: string
  points: ProgressPoint[]
  best: number
  sessions: number
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Прогресс по каждому упражнению пользователя как временной ряд:
 *  для каждого тренировочного дня — лучший e1RM и суммарный объём (тоннаж). */
export async function exerciseProgress(executor: Executor, userId: number): Promise<ExerciseProgress[]> {
  // Подходы могли писаться под дубль упражнения (alias_of → канон) —
  // сводим к каноническому упражнению, чтобы прогресс не двоился.
  const canon = alias(exercises, 'canon')
  const rows = await executor
    .select({
      exerciseId: canon.id,
      name: canon.name,
      weight: sets.weight,
      reps: sets.reps,
      createdAt: sets.createdAt,
    })
    .from(sets)
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .innerJoin(canon, eq(canon.id, sql`coalesce(${exercises.aliasOf}, ${exercises.id})`))
    .where(eq(sets.userId, userId))
    .orderBy(asc(sets.createdAt), asc(sets.id))

  const byExercise = new Map<number, { name: string; days: Map<string, { e1rm: number; volume: number }> }>()
  for (const r of rows) {
    let ex = byExercise.get(r.exerciseId)
    if (!ex) { ex = { name: r.name, days: new Map() }; byExercise.set(r.exerciseId, ex) }
    const key = dayKey(r.createdAt)
    const day = ex.days.get(key) ?? { e1rm: 0, volume: 0 }
    day.e1rm = Math.max(day.e1rm, e1rm(r.weight, r.reps))
    day.volume = Math.round((day.volume + tonnage(r.weight, r.reps)) * 10) / 10
    ex.days.set(key, day)
  }

  const result: ExerciseProgress[] = []
  for (const [exerciseId, ex] of byExercise) {
    const points = [...ex.days.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, e1rm: v.e1rm, volume: v.volume }))
    result.push({
      exerciseId,
      name: ex.name,
      points,
      best: Math.max(...points.map(p => p.e1rm)),
      sessions: points.length,
    })
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
