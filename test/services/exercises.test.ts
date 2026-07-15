import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb } from '../helpers/db'
import { exercises } from '~~/server/db/schema'
import { createExercise, getExercise, listExercises, updateExercise } from '~~/server/services/exercises'

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

  it('сохраняет индивидуальный шаг изменения веса', async () => {
    const { id } = await createExercise(testDb, { name: 'Подъём на бицепс', weightStep: 0.5 })
    expect((await getExercise(testDb, id))?.weightStep).toBe(0.5)

    await updateExercise(testDb, id, { weightStep: 1.25 })
    expect((await getExercise(testDb, id))?.weightStep).toBe(1.25)
  })

  it('использует шаг 2,5 кг по умолчанию', async () => {
    const { id } = await createExercise(testDb, { name: 'Тяга' })
    expect((await getExercise(testDb, id))?.weightStep).toBe(2.5)
  })
})
