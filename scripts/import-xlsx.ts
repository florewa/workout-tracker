import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { db } from '~~/server/db/client'
import {
  users, exercises, programDays, programExercises, workouts, workoutMembers, sets,
} from '~~/server/db/schema'
import {
  loadWorkbook, parseReference, parseJournal, parseProgram,
} from '~~/scripts/parse-xlsx'

const FILE = 'data/План тренировок.xlsx'

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function getOrCreateUser(executor: Executor, name: string, cache: Map<string, number>): Promise<number> {
  const cached = cache.get(name)
  if (cached) return cached
  const existing = await executor.select().from(users).where(eq(users.name, name)).limit(1)
  if (existing.length) {
    cache.set(name, existing[0].id)
    return existing[0].id
  }
  const inserted = await executor.insert(users).values({ name }).returning({ id: users.id })
  cache.set(name, inserted[0].id)
  return inserted[0].id
}

async function getOrCreateExercise(executor: Executor, name: string, cache: Map<string, number>): Promise<number> {
  const cached = cache.get(name)
  if (cached) return cached
  const existing = await executor.select().from(exercises).where(eq(exercises.name, name)).limit(1)
  if (existing.length) {
    cache.set(name, existing[0].id)
    return existing[0].id
  }
  const inserted = await executor.insert(exercises).values({ name }).returning({ id: exercises.id })
  cache.set(name, inserted[0].id)
  return inserted[0].id
}

async function main() {
  const wb = await loadWorkbook(FILE)
  const ref = parseReference(wb)
  const journal = parseJournal(wb)
  const program = parseProgram(wb)

  const userCache = new Map<string, number>()
  const exerciseCache = new Map<string, number>()

  // 1. Упражнения из справочника
  for (const name of ref.exercises) {
    await getOrCreateExercise(db, name, exerciseCache)
  }

  // 2. Программа: дни + упражнения дня
  for (const day of program) {
    await db.transaction(async (tx) => {
      const existingDay = await tx.select().from(programDays)
        .where(eq(programDays.code, day.code)).limit(1)
      let dayId: number
      if (existingDay.length) {
        dayId = existingDay[0].id
        // переписываем упражнения дня начисто (идемпотентность)
        await tx.delete(programExercises).where(eq(programExercises.dayId, dayId))
      } else {
        const ins = await tx.insert(programDays)
          .values({ code: day.code, title: day.title, order: day.order })
          .returning({ id: programDays.id })
        dayId = ins[0].id
      }
      for (const ex of day.exercises) {
        const exerciseId = await getOrCreateExercise(tx, ex.name, exerciseCache)
        await tx.insert(programExercises).values({
          dayId,
          exerciseId,
          order: ex.order,
          targetSets: ex.sets ?? null,
          targetReps: ex.reps ?? null,
          tempo: ex.tempo ?? null,
          restSec: ex.rest ?? null,
        })
      }
    })
  }

  // 3. Журнал: группируем по дате -> одна тренировка на дату
  const byDate = new Map<string, typeof journal>()
  for (const row of journal) {
    const key = dayKey(row.date)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(row)
  }

  for (const [key, rows] of byDate) {
    const date = new Date(key)
    // пропускаем дату, если тренировка на неё уже импортирована
    const existing = await db.select().from(workouts).where(eq(workouts.date, date)).limit(1)
    if (existing.length) continue

    await db.transaction(async (tx) => {
      const workoutIns = await tx.insert(workouts).values({ date }).returning({ id: workouts.id })
      const workoutId = workoutIns[0].id

      const members = new Set<number>()
      // порядковый номер подхода в рамках (пользователь+упражнение) этой тренировки
      const setOrderKey = new Map<string, number>()

      for (const row of rows) {
        const userId = await getOrCreateUser(tx, row.who, userCache)
        const exerciseId = await getOrCreateExercise(tx, row.exercise, exerciseCache)
        members.add(userId)
        const k = `${userId}:${exerciseId}`
        const order = (setOrderKey.get(k) ?? 0) + 1
        setOrderKey.set(k, order)
        await tx.insert(sets).values({
          workoutId,
          userId,
          exerciseId,
          setOrder: order,
          weight: row.weight,
          reps: row.reps,
        })
      }

      for (const userId of members) {
        await tx.insert(workoutMembers).values({ workoutId, userId }).onConflictDoNothing()
      }
    })
  }

  const [{ count: exCount }] = await db.select({ count: sql<number>`count(*)` }).from(exercises)
  const [{ count: setCount }] = await db.select({ count: sql<number>`count(*)` }).from(sets)
  console.log(`Импорт завершён: упражнений=${exCount}, подходов=${setCount}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
