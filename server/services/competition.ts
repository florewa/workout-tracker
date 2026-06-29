import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { db as dbType } from '~~/server/db/client'
import { sets, exercises, friendships, users } from '~~/server/db/schema'
import { e1rm, tonnage } from '~~/server/utils/metrics'

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
  participants: { id: number; name: string }[]
  exercises: { exerciseId: number; name: string }[]
  // По каждому упражнению — ряды для «гонки» и лидерборд
  byExercise: Record<number, {
    series: { userId: number; baseline: number; points: { date: string; e1rm: number }[] }[]
    leaderboard: { userId: number; startE1rm: number; currentE1rm: number; deltaKg: number; deltaPct: number }[]
  }>
  rankings: {
    growth: { userId: number; deltaPct: number }[]
    consistency: { userId: number; sessions: number }[]
    records: { userId: number; count: number }[]
    heaviest: { userId: number; e1rm: number; exerciseName: string }[]
    tonnage: { userId: number; value: number }[]
  }
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
    .select({ id: users.id, name: users.name })
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
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .innerJoin(canon, eq(canon.id, sql`coalesce(${exercises.aliasOf}, ${exercises.id})`))
    .where(and(inArray(sets.userId, ids), eq(sets.skipped, false)))
    .orderBy(asc(sets.createdAt), asc(sets.id))

  // Группировка: упражнение -> участник -> дни (лучший e1RM за день) + PR/посещаемость/тоннаж
  const exNames = new Map<number, string>()
  // key `${exId}:${userId}` -> Map<dayKey, bestE1rm>
  const daily = new Map<string, Map<string, number>>()
  // PR-счётчик и бегущий максимум по (exId,userId)
  const runningMax = new Map<string, number>()
  const prCount = new Map<number, number>() // userId -> count
  const sessions = new Map<number, Set<number>>() // userId -> set of workoutId (в периоде)
  const tonByUser = new Map<number, number>() // userId -> тоннаж в периоде
  const heaviest = new Map<number, { e1rm: number; exerciseName: string }>() // userId -> max e1rm в периоде

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
      tonByUser.set(r.userId, round1((tonByUser.get(r.userId) ?? 0) + tonnage(r.weight, r.reps)))
      const h = heaviest.get(r.userId)
      if (!h || val > h.e1rm) heaviest.set(r.userId, { e1rm: val, exerciseName: r.name })
    }
  }

  // Сбор по упражнениям: ряды и лидерборд (только участники с активностью в периоде)
  const byExercise: CompetitionPayload['byExercise'] = {}
  const exerciseIds = new Set<number>()
  const growthAcc = new Map<number, { sum: number; n: number }>() // userId -> средний Δ%

  for (const [k, days] of daily) {
    const [exIdStr, userIdStr] = k.split(':')
    const exId = Number(exIdStr)
    const userId = Number(userIdStr)
    const sorted = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const inPeriodPts = sorted.filter(([d]) => d >= startKey)
    if (!inPeriodPts.length) continue // нет активности в периоде — не участвует

    exerciseIds.add(exId)
    // baseline: последнее значение на момент начала периода (или первое в периоде)
    const before = sorted.filter(([d]) => d < startKey)
    const baseline = before.length ? before[before.length - 1][1] : inPeriodPts[0][1]
    const current = inPeriodPts[inPeriodPts.length - 1][1]
    const deltaKg = round1(current - baseline)
    const deltaPct = baseline > 0 ? round1((deltaKg / baseline) * 100) : 0

    if (!byExercise[exId]) byExercise[exId] = { series: [], leaderboard: [] }
    byExercise[exId].series.push({
      userId,
      baseline,
      points: inPeriodPts.map(([date, e1rm]) => ({ date, e1rm })),
    })
    byExercise[exId].leaderboard.push({ userId, startE1rm: baseline, currentE1rm: current, deltaKg, deltaPct })

    const g = growthAcc.get(userId) ?? { sum: 0, n: 0 }
    g.sum += deltaPct; g.n += 1
    growthAcc.set(userId, g)
  }

  for (const exId of Object.keys(byExercise)) {
    byExercise[Number(exId)].leaderboard.sort((a, b) => b.deltaPct - a.deltaPct)
  }

  const exerciseList = [...exerciseIds]
    .map(id => ({ exerciseId: id, name: exNames.get(id) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const rankings: CompetitionPayload['rankings'] = {
    growth: [...growthAcc.entries()]
      .map(([userId, g]) => ({ userId, deltaPct: round1(g.sum / g.n) }))
      .sort((a, b) => b.deltaPct - a.deltaPct),
    consistency: [...sessions.entries()]
      .map(([userId, s]) => ({ userId, sessions: s.size }))
      .sort((a, b) => b.sessions - a.sessions),
    records: [...prCount.entries()]
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count),
    heaviest: [...heaviest.entries()]
      .map(([userId, h]) => ({ userId, e1rm: h.e1rm, exerciseName: h.exerciseName }))
      .sort((a, b) => b.e1rm - a.e1rm),
    tonnage: [...tonByUser.entries()]
      .map(([userId, value]) => ({ userId, value }))
      .sort((a, b) => b.value - a.value),
  }

  return {
    period: { key: periodKey, label: PERIOD_LABEL[periodKey], start: start.toISOString() },
    participants,
    exercises: exerciseList,
    byExercise,
    rankings,
  }
}
