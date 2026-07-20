import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { programDays, programSchedules } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export interface ScheduledProgram {
  id: number
  code: string
  title: string
  order: number
}

export interface WeeklyScheduleSlot {
  weekday: number
  day: ScheduledProgram
}

export interface DateScheduleSlot {
  date: string
  day: ScheduledProgram | null
  source: 'weekly' | 'override' | null
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isoWeekday(value: string): number {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

function dayFromRow(row: { id: number; code: string; title: string; order: number }): ScheduledProgram {
  return { id: row.id, code: row.code, title: row.title, order: row.order }
}

async function requireProgramDay(executor: Executor, dayId: number): Promise<void> {
  const [day] = await executor.select({ id: programDays.id }).from(programDays).where(eq(programDays.id, dayId)).limit(1)
  if (!day) throw new Error('PROGRAM_DAY_NOT_FOUND')
}

// Строки новой таблицы имеют приоритет; legacy weekday сохраняет совместимость
// с импортом и тестовыми данными, созданными до появления расписания.
export async function listWeeklySchedule(executor: Executor): Promise<WeeklyScheduleSlot[]> {
  const [scheduled, legacy] = await Promise.all([
    executor
      .select({
        weekday: programSchedules.weekday,
        id: programDays.id,
        code: programDays.code,
        title: programDays.title,
        order: programDays.order,
      })
      .from(programSchedules)
      .innerJoin(programDays, eq(programDays.id, programSchedules.dayId))
      .where(isNotNull(programSchedules.weekday)),
    executor
      .select({
        weekday: programDays.weekday,
        id: programDays.id,
        code: programDays.code,
        title: programDays.title,
        order: programDays.order,
      })
      .from(programDays)
      .where(isNotNull(programDays.weekday))
      .orderBy(asc(programDays.order)),
  ])

  const slots = new Map<number, WeeklyScheduleSlot>()
  for (const row of legacy) {
    if (row.weekday != null && row.weekday >= 1 && row.weekday <= 7 && !slots.has(row.weekday)) {
      slots.set(row.weekday, { weekday: row.weekday, day: dayFromRow(row) })
    }
  }
  for (const row of scheduled) {
    if (row.weekday != null && row.weekday >= 1 && row.weekday <= 7) {
      slots.set(row.weekday, { weekday: row.weekday, day: dayFromRow(row) })
    }
  }
  return [...slots.values()].sort((a, b) => a.weekday - b.weekday)
}

export async function setWeeklySchedule(executor: Executor, weekday: number, dayId: number | null): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new Error('INVALID_WEEKDAY')
  if (dayId != null) await requireProgramDay(executor, dayId)

  await executor.transaction(async (tx) => {
    await tx.delete(programSchedules).where(eq(programSchedules.weekday, weekday))
    // Убираем legacy-привязку, иначе после очистки нового слота она проявится снова.
    await tx.update(programDays).set({ weekday: null }).where(eq(programDays.weekday, weekday))
    if (dayId != null) {
      await tx.insert(programSchedules).values({ weekday, dayId })
      // Поддерживаем старые клиенты: поле хранит одно из назначений программы.
      await tx.update(programDays).set({ weekday }).where(eq(programDays.id, dayId))
    }
  })
}

export async function setDateSchedule(executor: Executor, date: string, dayId: number | null): Promise<void> {
  if (!isIsoDate(date)) throw new Error('INVALID_DATE')
  if (dayId != null) await requireProgramDay(executor, dayId)
  await executor
    .insert(programSchedules)
    .values({ date, dayId })
    .onConflictDoUpdate({ target: programSchedules.date, set: { dayId } })
}

export async function clearDateSchedule(executor: Executor, date: string): Promise<void> {
  if (!isIsoDate(date)) throw new Error('INVALID_DATE')
  await executor.delete(programSchedules).where(eq(programSchedules.date, date))
}

export async function resolveScheduleRange(executor: Executor, from: string, to: string): Promise<DateScheduleSlot[]> {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) throw new Error('INVALID_DATE_RANGE')

  const [weekly, overrides] = await Promise.all([
    listWeeklySchedule(executor),
    executor
      .select({
        date: programSchedules.date,
        dayId: programSchedules.dayId,
        id: programDays.id,
        code: programDays.code,
        title: programDays.title,
        order: programDays.order,
      })
      .from(programSchedules)
      .leftJoin(programDays, eq(programDays.id, programSchedules.dayId))
      .where(and(gte(programSchedules.date, from), lte(programSchedules.date, to))),
  ])

  const weeklyMap = new Map(weekly.map(slot => [slot.weekday, slot.day]))
  const overrideMap = new Map(overrides.filter(row => row.date != null).map(row => [row.date!, row]))
  const result: DateScheduleSlot[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10)
    const override = overrideMap.get(date)
    if (override) {
      result.push({
        date,
        day: override.dayId != null && override.id != null
          ? dayFromRow({ id: override.id, code: override.code!, title: override.title!, order: override.order! })
          : null,
        source: 'override',
      })
    } else {
      const day = weeklyMap.get(isoWeekday(date)) ?? null
      result.push({ date, day, source: day ? 'weekly' : null })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

export async function getScheduledProgram(executor: Executor, date: string): Promise<DateScheduleSlot> {
  const [slot] = await resolveScheduleRange(executor, date, date)
  if (!slot) throw new Error('Не удалось рассчитать расписание')
  return slot
}
