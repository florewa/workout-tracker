import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { users } from '~~/server/db/schema'
import { getReminderRecipients, setReminders, buildReminderText } from '~~/server/services/reminders'

beforeEach(async () => { await resetDb() })

describe('reminders', () => {
  it('в рассылку попадают только подписанные с telegram_id', async () => {
    const { danil, egor } = await seedBaseline()
    await testDb.update(users).set({ telegramId: 111 }).where(eq(users.id, danil))
    await testDb.update(users).set({ telegramId: 222 }).where(eq(users.id, egor))

    await setReminders(testDb, egor, false) // Егор отписался

    const recipients = await getReminderRecipients(testDb)
    const ids = recipients.map(r => r.telegramId).sort()
    expect(ids).toEqual([111])
  })

  it('текст содержит план дня и упражнения', async () => {
    const text = buildReminderText({ code: 'A', title: 'Верх A', exercises: ['Жим', 'Тяга', 'Присед', 'Бицепс'] }, 0)
    expect(text).toContain('Верх A')
    expect(text).toContain('Жим')
    expect(text).toContain('и не только')
  })
})
