import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { programDays } from '~~/server/db/schema'
import {
  clearDateSchedule,
  listWeeklySchedule,
  resolveScheduleRange,
  setDateSchedule,
  setWeeklySchedule,
} from '~~/server/services/schedule'
import { deleteDay } from '~~/server/services/program'

beforeEach(async () => { await resetDb() })

describe('schedule', () => {
  it('подхватывает старое поле weekday как недельный план', async () => {
    const { dayId } = await seedBaseline()
    await testDb.update(programDays).set({ weekday: 1 }).where(eq(programDays.id, dayId))

    const schedule = await listWeeklySchedule(testDb)

    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({ weekday: 1, day: { id: dayId, code: 'Верх A' } })
  })

  it('назначает одну программу на несколько дней и освобождает отдельный слот', async () => {
    const { dayId } = await seedBaseline()
    await setWeeklySchedule(testDb, 1, dayId)
    await setWeeklySchedule(testDb, 4, dayId)

    expect((await listWeeklySchedule(testDb)).map(slot => [slot.weekday, slot.day.id])).toEqual([
      [1, dayId],
      [4, dayId],
    ])

    await setWeeklySchedule(testDb, 1, null)
    expect((await listWeeklySchedule(testDb)).map(slot => slot.weekday)).toEqual([4])
  })

  it('переопределение даты побеждает недельный план, в том числе для отдыха', async () => {
    const { dayId } = await seedBaseline()
    const [other] = await testDb.insert(programDays)
      .values({ code: 'Низ A', title: 'ДЕНЬ 2 · НИЗ A', order: 2 })
      .returning({ id: programDays.id })
    await setWeeklySchedule(testDb, 1, dayId)

    await setDateSchedule(testDb, '2026-07-13', other.id) // понедельник
    await setDateSchedule(testDb, '2026-07-14', null)
    const overridden = await resolveScheduleRange(testDb, '2026-07-13', '2026-07-14')

    expect(overridden[0]).toMatchObject({ source: 'override', day: { id: other.id } })
    expect(overridden[1]).toEqual({ date: '2026-07-14', day: null, source: 'override' })

    await clearDateSchedule(testDb, '2026-07-13')
    const [restored] = await resolveScheduleRange(testDb, '2026-07-13', '2026-07-13')
    expect(restored).toMatchObject({ source: 'weekly', day: { id: dayId } })
  })

  it('удаляет назначения вместе с программой, сохраняя целостность расписания', async () => {
    const { dayId } = await seedBaseline()
    await setWeeklySchedule(testDb, 1, dayId)
    await setDateSchedule(testDb, '2026-07-15', dayId)

    await deleteDay(testDb, dayId)

    expect(await listWeeklySchedule(testDb)).toEqual([])
    expect(await resolveScheduleRange(testDb, '2026-07-15', '2026-07-15')).toEqual([
      { date: '2026-07-15', day: null, source: null },
    ])
  })
})
