import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { listProgramDays, getProgramDay } from '~~/server/services/program'

beforeEach(async () => { await resetDb() })

describe('program', () => {
  it('listProgramDays возвращает дни по порядку', async () => {
    await seedBaseline()
    const days = await listProgramDays(testDb)
    expect(days.length).toBe(1)
    expect(days[0].code).toBe('Верх A')
  })

  it('getProgramDay отдаёт день с упражнениями', async () => {
    const { benchId } = await seedBaseline()
    const res = await getProgramDay(testDb, 'Верх A')
    expect(res).not.toBeNull()
    expect(res!.day.code).toBe('Верх A')
    expect(res!.exercises[0].id).toBe(benchId)
    expect(res!.exercises[0].targetSets).toBe(5)
  })

  it('getProgramDay возвращает null для неизвестного кода', async () => {
    await seedBaseline()
    expect(await getProgramDay(testDb, 'Нет')).toBeNull()
  })
})
