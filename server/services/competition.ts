import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises, friendships, users, workouts } from '~~/server/db/schema'
import { e1rm } from '~~/server/utils/metrics'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export type PeriodKey = '1m' | '3m' | '6m' | '1y' | 'all'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  '1m': 'Месяц', '3m': '3 месяца', '6m': 'Полгода', '1y': 'Год', all: 'Всё время',
}

function periodStart(key: PeriodKey): Date {
  const now = new Date()
  const d = new Date(now)
  switch (key) {
    case '1m': d.setMonth(d.getMonth() - 1); break
    case '3m': d.setMonth(d.getMonth() - 3); break
    case '6m': d.setMonth(d.getMonth() - 6); break
    case '1y': d.setFullYear(d.getFullYear() - 1); break
    case 'all': return new Date(0)
  }
  return d
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// Круг: я + друзья
async function circleIds(executor: Executor, meId: number): Promise<number[]> {
  const rows = await executor
    .select({ low: friendships.userLow, high: friendships.userHigh })
    .from(friendships)
    .where(sql`${friendships.userLow} = ${meId} or ${friendships.userHigh} = ${meId}`)
  const ids = new Set<number>([meId])
  for (const r of rows) ids.add(r.low === meId ? r.high : r.low)
  return [...ids]
}

export interface CompetitionPayload {
  period: { key: PeriodKey; label: string; start: string }
  participants: { id: number; name: string; avatarUrl: string | null }[]
  exercises: { exerciseId: number; name: string }[]
  // По каждому упражнению — ряды для «гонки» и лидерборд
  byExercise: Record<number, {
    series: { userId: number; baseline: number; points: { date: string; e1rm: number }[] }[]
    leaderboard: {
      userId: number
      startE1rm: number
      currentE1rm: number
      deltaKg: number
      deltaPct: number
      observations: number
      eligible: boolean
    }[]
  }>
  rankings: {
    growth: { userId: number; scorePct: number; exerciseCount: number }[]
    consistency: { userId: number; sessions: number }[]
    records: { userId: number; count: number }[]
  }
  sharedExerciseIds: number[]
  minimumObservations: number
}

export async function competition(
  executor: Executor,
  meId: number,
  periodKey: PeriodKey,
): Promise<CompetitionPayload> {
  const ids = await circleIds(executor, meId)
  const start = periodStart(periodKey)
  const startKey = dayKey(start)

  const participants = await executor
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.name))

  // Все подходы круга (кроме пропущенных), сведённые к каноническому упражнению
  const canon = alias(exercises, 'canon')
  const rows = await executor
    .select({
      userId: sets.userId,
      workoutId: sets.workoutId,
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
    .where(and(inArray(sets.userId, ids), eq(sets.skipped, false), isNull(workouts.deletedAt)))
    .orderBy(asc(sets.createdAt), asc(sets.id))

  // Группировка: упражнение -> участник -> дни (лучший e1RM за день) + PR/посещаемость/тоннаж
  const exNames = new Map<number, string>()
  // key `${exId}:${userId}` -> Map<dayKey, bestE1rm>
  const daily = new Map<string, Map<string, number>>()
  // PR-счётчик и бегущий максимум по (exId,userId)
  const runningMax = new Map<string, number>()
  const prCount = new Map<number, number>() // userId -> count
  const sessions = new Map<number, Set<number>>() // userId -> set of workoutId (в периоде)

  for (const r of rows) {
    exNames.set(r.exerciseId, r.name)
    const val = e1rm(r.weight, r.reps)
    const k = `${r.exerciseId}:${r.userId}`
    const inPeriod = dayKey(r.createdAt) >= startKey

    // PR: новый личный максимум за всю историю, попавший в период
    const prev = runningMax.get(k) ?? 0
    if (val > prev) {
      runningMax.set(k, val)
      if (inPeriod) prCount.set(r.userId, (prCount.get(r.userId) ?? 0) + 1)
    }

    // Дневной лучший e1RM (вся история — нужно для baseline до периода)
    let days = daily.get(k)
    if (!days) { days = new Map(); daily.set(k, days) }
    const dk = dayKey(r.createdAt)
    days.set(dk, Math.max(days.get(dk) ?? 0, val))

    if (inPeriod) {
      let s = sessions.get(r.userId)
      if (!s) { s = new Set(); sessions.set(r.userId, s) }
      s.add(r.workoutId)
    }
  }

  // Сбор по упражнениям: ряды и лидерборд (только участники с активностью в периоде)
  const byExercise: CompetitionPayload['byExercise'] = {}
  const exerciseIds = new Set<number>()
  const MINIMUM_OBSERVATIONS = 4

  for (const [k, days] of daily) {
    const [exIdStr, userIdStr] = k.split(':')
    const exId = Number(exIdStr)
    const userId = Number(userIdStr)
    const sorted = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const inPeriodPts = sorted.filter(([d]) => d >= startKey)
    if (!inPeriodPts.length) continue // нет активности в периоде — не участвует

    exerciseIds.add(exId)
    // Для рейтинга нужно минимум четыре замера. Старт и финиш — среднее
    // двух тренировок: один случайно удачный/неудачный день не должен решать гонку.
    const observations = inPeriodPts.length
    const eligible = observations >= MINIMUM_OBSERVATIONS
    const baselineValues = eligible ? inPeriodPts.slice(0, 2).map(([, value]) => value) : [inPeriodPts[0]![1]]
    const currentValues = eligible ? inPeriodPts.slice(-2).map(([, value]) => value) : [inPeriodPts.at(-1)![1]]
    const baseline = round1(average(baselineValues))
    const current = round1(average(currentValues))
    const deltaKg = round1(current - baseline)
    const deltaPct = baseline > 0 ? round1((deltaKg / baseline) * 100) : 0

    const exerciseBlock = byExercise[exId] ?? { series: [], leaderboard: [] }
    byExercise[exId] = exerciseBlock
    exerciseBlock.series.push({
      userId,
      baseline,
      points: inPeriodPts.map(([date, e1rm]) => ({ date, e1rm })),
    })
    exerciseBlock.leaderboard.push({
      userId, startE1rm: baseline, currentE1rm: current, deltaKg, deltaPct, observations, eligible,
    })
  }

  for (const exId of Object.keys(byExercise)) {
    byExercise[Number(exId)]?.leaderboard.sort((a, b) => b.deltaPct - a.deltaPct)
  }

  const exerciseList = [...exerciseIds]
    .map(id => ({ exerciseId: id, name: exNames.get(id) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  // В общий счёт идут только упражнения, где есть достаточно замеров минимум у двух
  // участников. Медиана не даёт одному выбросу перевернуть рейтинг.
  const sharedExerciseIds = Object.entries(byExercise)
    .filter(([, value]) => value.leaderboard.filter(row => row.eligible).length >= 2)
    .map(([exerciseId]) => Number(exerciseId))
  const growthValues = new Map<number, number[]>()
  for (const exerciseId of sharedExerciseIds) {
    for (const row of byExercise[exerciseId]?.leaderboard ?? []) {
      if (!row.eligible) continue
      const values = growthValues.get(row.userId) ?? []
      values.push(row.deltaPct)
      growthValues.set(row.userId, values)
    }
  }

  const rankings: CompetitionPayload['rankings'] = {
    growth: [...growthValues.entries()]
      .map(([userId, values]) => ({ userId, scorePct: round1(median(values)), exerciseCount: values.length }))
      .sort((a, b) => b.scorePct - a.scorePct),
    consistency: [...sessions.entries()]
      .map(([userId, s]) => ({ userId, sessions: s.size }))
      .sort((a, b) => b.sessions - a.sessions),
    records: [...prCount.entries()]
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count),
  }

  return {
    period: { key: periodKey, label: PERIOD_LABEL[periodKey], start: start.toISOString() },
    participants,
    exercises: exerciseList,
    byExercise,
    rankings,
    sharedExerciseIds,
    minimumObservations: MINIMUM_OBSERVATIONS,
  }
}
