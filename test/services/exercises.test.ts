import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb } from '../helpers/db'
import { exercises } from '~~/server/db/schema'
import { listExercises } from '~~/server/services/exercises'

beforeEach(async () => { await resetDb() })

describe('listExercises', () => {
  it('возвращает только канонические, без алиасов и архивных', async () => {
    const [canon] = await testDb.insert(exercises).values({ name: 'Жим лёжа' }).returning({ id: exercises.id })
    await testDb.insert(exercises).values({ name: 'жим лежа (дубль)', aliasOf: canon.id })
    await testDb.insert(exercises).values({ name: 'Архивное', isArchived: true })
    await testDb.insert(exercises).values({ name: 'Присед' })
    const list = await listExercises(testDb)
    const names = list.map((e) => e.name)
    expect(names).toContain('Жим лёжа')
    expect(names).toContain('Присед')
    expect(names).not.toContain('жим лежа (дубль)')
    expect(names).not.toContain('Архивное')
  })

  it('фильтрует по поиску регистронезависимо', async () => {
    await testDb.insert(exercises).values({ name: 'Жим лёжа' })
    await testDb.insert(exercises).values({ name: 'Присед' })
    const list = await listExercises(testDb, { search: 'жим' })
    expect(list.map((e) => e.name)).toEqual(['Жим лёжа'])
  })
})
