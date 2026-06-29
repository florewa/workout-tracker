import 'dotenv/config'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~~/server/db/client'
import { users, exercises, programDays, workouts, workoutMembers, sets } from '~~/server/db/schema'
import { addFriendship } from '~~/server/services/friends'

// Сброс журнала тренировок к эталонным данным (Пн/Вт/Чт) для Данила и Егора.
// Упражнения/программа/пользователи сохраняются; стираются только workouts/sets/members.

type Who = 'Д' | 'Е'
// [кто, вес, повторы, заметка?]
type SetTuple = [Who, number, number, string?]
interface Ex { name: string; sets: SetTuple[] }
interface Day { label: string; weekday: number; exercises: Ex[] }

const DAYS: Day[] = [
  {
    label: 'Понедельник', weekday: 1, exercises: [
      { name: 'Жим гантелей на наклонной 30°', sets: [
        ['Е', 24, 10], ['Д', 14, 12], ['Е', 24, 12], ['Д', 16, 12],
        ['Е', 24, 12], ['Д', 18, 12], ['Е', 24, 12], ['Д', 18, 8],
      ] },
      { name: 'Тяга штанги в наклоне', sets: [
        ['Е', 60, 10], ['Д', 40, 10], ['Е', 70, 10], ['Д', 40, 12],
        ['Е', 70, 10], ['Д', 40, 10], ['Е', 70, 10], ['Д', 40, 12],
      ] },
      { name: 'Тяга верхнего блока нейтральным хватом', sets: [
        ['Е', 75, 12], ['Д', 65, 12], ['Е', 85, 12], ['Д', 75, 12],
        ['Е', 90, 10], ['Д', 80, 12],
      ] },
      { name: 'Жим гантелей лёжа на горизонтальной скамье', sets: [
        ['Е', 20, 12], ['Д', 12, 12], ['Е', 24, 10], ['Д', 14, 12],
        ['Е', 24, 9], ['Д', 14, 12],
      ] },
      { name: 'Махи гантелями в стороны', sets: [
        ['Е', 10, 12], ['Д', 6, 12], ['Е', 10, 12], ['Д', 6, 12],
        ['Е', 10, 12], ['Д', 6, 12],
      ] },
      { name: 'Французский жим', sets: [
        ['Е', 20, 10], ['Д', 20, 10], ['Е', 25, 12], ['Д', 15, 10],
        ['Е', 20, 10], ['Д', 15, 10],
      ] },
      { name: 'Подъём штанги на бицепс', sets: [
        ['Е', 35, 15], ['Д', 20, 12], ['Е', 40, 12], ['Д', 25, 12],
        ['Е', 40, 10], ['Д', 25, 12],
      ] },
      { name: 'Внешняя ротация плеча на блоке', sets: [
        ['Е', 5, 10], ['Д', 5, 12], ['Е', 5, 10], ['Д', 5, 12],
      ] },
    ],
  },
  {
    label: 'Вторник', weekday: 2, exercises: [
      { name: 'Присед со штангой', sets: [
        ['Д', 30, 8], ['Е', 30, 10], ['Д', 40, 10], ['Е', 80, 10],
        ['Д', 50, 10], ['Е', 100, 10], ['Д', 50, 10], ['Е', 120, 6],
      ] },
      { name: 'Гоблет-приседания', sets: [
        ['Д', 12, 12], ['Е', 12, 12], ['Д', 16, 12], ['Е', 20, 12],
        ['Д', 16, 12], ['Е', 24, 12],
      ] },
      { name: 'Румынская тяга со штангой', sets: [
        ['Д', 30, 10], ['Е', 60, 10], ['Д', 40, 10], ['Е', 60, 10],
        ['Д', 40, 10], ['Е', 60, 10],
      ] },
      { name: 'Разгибание ног в тренажёре сидя', sets: [
        ['Д', 50, 12], ['Е', 50, 12], ['Д', 45, 12], ['Е', 45, 15],
        ['Д', 45, 12], ['Е', 50, 12],
      ] },
      { name: 'Сгибание ног лёжа', sets: [
        ['Д', 20, 12], ['Е', 25, 12], ['Д', 25, 12], ['Е', 30, 12],
        ['Д', 25, 12], ['Е', 30, 12],
      ] },
      { name: 'Подъём на носки стоя (в Смите)', sets: [
        ['Д', 40, 16], ['Е', 40, 20], ['Д', 50, 14], ['Е', 50, 18],
        ['Д', 50, 14], ['Е', 50, 20], ['Д', 50, 14], ['Е', 50, 16],
      ] },
      { name: 'Подъём ног в висе', sets: [
        ['Д', 0, 12], ['Д', 0, 12], ['Д', 0, 12],
      ] },
    ],
  },
  {
    label: 'Четверг', weekday: 4, exercises: [
      { name: 'Жим гантелей сидя', sets: [
        ['Д', 14, 12], ['Е', 20, 12], ['Д', 16, 10], ['Е', 24, 10],
        ['Д', 16, 10], ['Е', 24, 8], ['Д', 16, 8], ['Е', 20, 6],
      ] },
      { name: 'Тяга верхнего блока', sets: [
        ['Д', 65, 12], ['Е', 100, 10], ['Д', 75, 12], ['Е', 90, 10],
        ['Д', 80, 10], ['Е', 90, 10], ['Д', 75, 10], ['Е', 90, 10],
      ] },
      { name: 'Тяга горизонтального блока', sets: [
        ['Д', 65, 12], ['Е', 100, 10], ['Д', 70, 12], ['Е', 100, 10],
        ['Д', 75, 12], ['Е', 100, 10],
      ] },
      { name: 'Бабочка', sets: [
        ['Д', 10, 12], ['Е', 10, 12], ['Д', 10, 12], ['Е', 10, 15],
        ['Д', 10, 12], ['Е', 13, 15],
      ] },
      { name: 'Махи в стороны', sets: [
        ['Д', 6, 12], ['Е', 5, 12], ['Д', 5, 12], ['Е', 10, 10],
        ['Д', 5, 14], ['Е', 10, 10],
      ] },
      { name: 'Тяга каната к лицу', sets: [
        ['Д', 25, 12], ['Е', 30, 12], ['Д', 30, 14], ['Е', 35, 12],
        ['Д', 35, 12], ['Е', 50, 8],
      ] },
      { name: 'Сгибание рук «молот»', sets: [
        ['Д', 8, 12], ['Е', 12, 10], ['Д', 8, 10], ['Е', 16, 6],
        ['Д', 6, 12], ['Е', 12, 8],
      ] },
      { name: 'Разгибание на блоке с канатом', sets: [
        ['Д', 25, 14], ['Е', 30, 12, '+ обратный хват 30×12'],
        ['Д', 25, 12, '+ обратный хват 25×12'], ['Е', 30, 12, '+ обратный хват 30×12'],
        ['Д', 25, 9, '+ обратный хват 25×9'], ['Е', 30, 10, '+ обратный хват 30×10'],
      ] },
    ],
  },
]

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

async function resolveUser(executor: Executor, name: string, username: string): Promise<number> {
  const byUsername = await executor.select().from(users).where(eq(users.username, username)).limit(1)
  if (byUsername.length) return byUsername[0].id
  const byName = await executor.select().from(users).where(and(eq(users.name, name), isNull(users.telegramId))).limit(1)
  if (byName.length) {
    await executor.update(users).set({ username }).where(eq(users.id, byName[0].id))
    return byName[0].id
  }
  const [created] = await executor.insert(users).values({ name, username }).returning({ id: users.id })
  return created.id
}

async function getOrCreateExercise(executor: Executor, name: string, cache: Map<string, number>): Promise<number> {
  const cached = cache.get(name)
  if (cached) return cached
  const existing = await executor.select().from(exercises).where(eq(exercises.name, name)).limit(1)
  const id = existing.length
    ? existing[0].id
    : (await executor.insert(exercises).values({ name }).returning({ id: exercises.id }))[0].id
  cache.set(name, id)
  return id
}

// Дата последнего прошедшего нужного дня недели (ISO 1..7) на 09:00
function lastWeekdayDate(weekday: number): Date {
  const now = new Date()
  const todayIso = ((now.getDay() + 6) % 7) + 1
  let back = todayIso - weekday
  if (back < 0) back += 7
  const d = new Date(now)
  d.setDate(d.getDate() - back - 7) // прошлая неделя — гарантированно в прошлом
  d.setHours(9, 0, 0, 0)
  return d
}

async function main() {
  await db.transaction(async (tx) => {
    // 1. Стираем журнал (упражнения/программу/пользователей сохраняем)
    await tx.delete(sets)
    await tx.delete(workoutMembers)
    await tx.delete(workouts)

    const danil = await resolveUser(tx, 'Данил', 'ash_danil')
    const egor = await resolveUser(tx, 'Егор', 'jeffri228')
    const uid: Record<Who, number> = { Д: danil, Е: egor }
    const exCache = new Map<string, number>()

    for (const day of DAYS) {
      const date = lastWeekdayDate(day.weekday)
      const finishedAt = new Date(date.getTime() + 90 * 60 * 1000)
      const [pday] = await tx.select({ id: programDays.id }).from(programDays).where(eq(programDays.weekday, day.weekday)).limit(1)

      const [w] = await tx.insert(workouts).values({
        date, createdBy: danil, dayId: pday?.id ?? null,
        recordMode: 'single', startedAt: date, finishedAt,
      }).returning({ id: workouts.id })

      await tx.insert(workoutMembers).values([
        { workoutId: w.id, userId: danil }, { workoutId: w.id, userId: egor },
      ]).onConflictDoNothing()

      const order = new Map<string, number>() // `${userId}:${exId}` -> n
      for (const ex of day.exercises) {
        const exId = await getOrCreateExercise(tx, ex.name, exCache)
        for (const [who, weight, reps, note] of ex.sets) {
          const userId = uid[who]
          const k = `${userId}:${exId}`
          const n = (order.get(k) ?? 0) + 1
          order.set(k, n)
          await tx.insert(sets).values({
            workoutId: w.id, userId, exerciseId: exId, setOrder: n, weight, reps, note: note ?? null,
          })
        }
      }
    }

    // 2. Дружим всех пользователей круга между собой
    const all = await tx.select({ id: users.id }).from(users)
    const ids = all.map(u => u.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        await addFriendship(tx, ids[i], ids[j])
      }
    }
  })

  const [{ w }] = await db.select({ w: sql<number>`count(*)` }).from(workouts)
  const [{ s }] = await db.select({ s: sql<number>`count(*)` }).from(sets)
  console.log(`Готово: тренировок=${w}, подходов=${s}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
