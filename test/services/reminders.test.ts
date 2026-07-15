import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { programDays, users } from '~~/server/db/schema'
import { getReminderRecipients, setReminders, buildReminderText, buildTrainingReminder } from '~~/server/services/reminders'
import { setDateSchedule, setWeeklySchedule } from '~~/server/services/schedule'

beforeEach(async () => { await resetDb() })

describe('reminders', () => {
  it('в рассылку попадают только подписанные с telegram_id', async () => {
    const { danil, egor } = await seedBaseline()
    await testDb.update(users).set({ telegramId: 111, remindersEnabled: true }).where(eq(users.id, danil))
    await testDb.update(users).set({ telegramId: 222, remindersEnabled: true }).where(eq(users.id, egor))

    await setReminders(testDb, egor, false) // Егор отписался

    const recipients = await getReminderRecipients(testDb)
    const ids = recipients.map(r => r.telegramId).sort()
    expect(ids).toEqual([111])
  })

  it('текст содержит план дня и упражнения', async () => {
    const text = buildReminderText({ code: 'Верх A', title: 'День 1', exercises: ['Жим', 'Тяга', 'Присед', 'Бицепс'] }, 0)
    expect(text).toContain('Верх A')
    expect(text).toContain('Жим')
    expect(text).toContain('и не только')
  })

  it('напоминание учитывает перенос и день отдыха на конкретную дату', async () => {
    const { dayId } = await seedBaseline()
    const [other] = await testDb.insert(programDays)
      .values({ code: 'Низ A', title: 'ДЕНЬ 2 · НИЗ A', order: 2 })
      .returning({ id: programDays.id })
    await setWeeklySchedule(testDb, 1, dayId)
    await setDateSchedule(testDb, '2026-07-13', other.id)

    const moved = await buildTrainingReminder(testDb, new Date('2026-07-13T09:00:00Z'))
    expect(moved?.plan.code).toBe('Низ A')

    await setDateSchedule(testDb, '2026-07-13', null)
    expect(await buildTrainingReminder(testDb, new Date('2026-07-13T09:00:00Z'))).toBeNull()
  })
})
