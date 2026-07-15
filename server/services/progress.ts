import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises, favoriteExercises, workouts } from '~~/server/db/schema'
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
  isFavorite: boolean
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
    .innerJoin(workouts, eq(workouts.id, sets.workoutId))
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .innerJoin(canon, eq(canon.id, sql`coalesce(${exercises.aliasOf}, ${exercises.id})`))
    .where(and(eq(sets.userId, userId), eq(sets.skipped, false), isNull(workouts.deletedAt)))
    .orderBy(asc(sets.createdAt), asc(sets.id))

  const favorites = await executor
    .select({ exerciseId: favoriteExercises.exerciseId, name: exercises.name })
    .from(favoriteExercises)
    .innerJoin(exercises, eq(exercises.id, favoriteExercises.exerciseId))
    .where(eq(favoriteExercises.userId, userId))

  const byExercise = new Map<number, {
    name: string
    days: Map<string, { e1rm: number; volume: number }>
    isFavorite: boolean
  }>()
  for (const favorite of favorites) {
    byExercise.set(favorite.exerciseId, { name: favorite.name, days: new Map(), isFavorite: true })
  }
  for (const r of rows) {
    let ex = byExercise.get(r.exerciseId)
    if (!ex) { ex = { name: r.name, days: new Map(), isFavorite: false }; byExercise.set(r.exerciseId, ex) }
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
      best: points.length ? Math.max(...points.map(p => p.e1rm)) : 0,
      sessions: points.length,
      isFavorite: ex.isFavorite,
    })
  }

  return result.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name, 'ru'))
}
