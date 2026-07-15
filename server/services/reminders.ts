import { and, eq, isNotNull } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { programExercises, exercises, users } from '~~/server/db/schema'
import { getScheduledProgram, listWeeklySchedule, type ScheduledProgram } from '~~/server/services/schedule'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

function mskDaySeed(now = new Date()): number {
  const ymd = mskIsoDate(now)
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000)
}

function mskIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export interface DayPlan { code: string; title: string; exercises: string[] }

async function loadDayPlan(executor: Executor, day: ScheduledProgram): Promise<DayPlan> {
  const exs = await executor
    .select({ name: exercises.name })
    .from(programExercises)
    .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
    .where(eq(programExercises.dayId, day.id))
    .orderBy(programExercises.order)
  return { code: day.code, title: day.title, exercises: exs.map(e => e.name) }
}

export async function getDayPlan(executor: Executor, weekday: number): Promise<DayPlan | null> {
  const day = (await listWeeklySchedule(executor)).find(slot => slot.weekday === weekday)?.day
  return day ? loadDayPlan(executor, day) : null
}

export async function getDayPlanForDate(executor: Executor, date: string): Promise<DayPlan | null> {
  const day = (await getScheduledProgram(executor, date)).day
  return day ? loadDayPlan(executor, day) : null
}

export async function getReminderRecipients(executor: Executor): Promise<{ telegramId: number; name: string }[]> {
  const rows = await executor
    .select({ telegramId: users.telegramId, name: users.name })
    .from(users)
    .where(and(isNotNull(users.telegramId), eq(users.remindersEnabled, true)))
  return rows.filter((r): r is { telegramId: number; name: string } => r.telegramId != null)
}

// Прикольные мотивашки — ротация по дню, чтобы не повторялось подряд
const LINES = [
  'Штанга сама себя не поднимет 😏',
  'Кто не пришёл — тот сегодня проставляется 🍕',
  'Стань сегодня чуть сильнее, чем вчера 💪',
  'Зал ждёт. Отмазки не принимаются 🚫',
  'Личный рекорд сам себя не поставит 🏆',
  'Пропустишь — друзья обгонят тебя в рейтинге 📈',
  'Размялся? Погнали 🏋️',
  'Будущий ты скажет спасибо за сегодняшний подход 🙏',
  'Мышцы растут не в зале, а от того, что ты до него дошёл 😅',
  'Сегодня твой день — иди и забери его 🔥',
]

export function buildReminderText(plan: DayPlan, seed: number): string {
  const line = LINES[((seed % LINES.length) + LINES.length) % LINES.length]
  const head = plan.exercises.slice(0, 3).join(', ')
  const tail = plan.exercises.length > 3 ? ' и не только' : ''
  const planLine = head ? `\n\nСегодня по плану <b>${plan.code}</b>: ${head}${tail}.` : `\n\nСегодня по плану <b>${plan.code}</b>.`
  return `💪 Не забудь про тренировку!${planLine}\n\n${line}`
}

export async function buildTrainingReminder(
  executor: Executor,
  now = new Date(),
): Promise<{ text: string; recipients: { telegramId: number; name: string }[]; plan: DayPlan } | null> {
  const plan = await getDayPlanForDate(executor, mskIsoDate(now))
  if (!plan) return null
  const recipients = await getReminderRecipients(executor)
  return { text: buildReminderText(plan, mskDaySeed(now)), recipients, plan }
}

export async function setReminders(executor: Executor, userId: number, enabled: boolean): Promise<void> {
  await executor.update(users).set({ remindersEnabled: enabled }).where(eq(users.id, userId))
}

export async function getReminders(executor: Executor, userId: number): Promise<boolean> {
  const [row] = await executor.select({ v: users.remindersEnabled }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.v ?? true
}
