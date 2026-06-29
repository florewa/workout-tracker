import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import { addSet } from '~~/server/services/sets'
import { listVariations, addVariation, setDefaultVariation, deleteVariation } from '~~/server/services/variations'

beforeEach(async () => { await resetDb() })

describe('variations', () => {
  it('первая вариация — дефолтная, смена дефолта работает', async () => {
    const { benchId } = await seedBaseline()
    const a = await addVariation(testDb, benchId, 'Штанга')
    const b = await addVariation(testDb, benchId, 'Гантели')
    let list = await listVariations(testDb, benchId)
    expect(list.find(v => v.id === a.id)?.isDefault).toBe(true)
    expect(list.find(v => v.id === b.id)?.isDefault).toBe(false)

    await setDefaultVariation(testDb, benchId, b.id)
    list = await listVariations(testDb, benchId)
    expect(list.find(v => v.id === a.id)?.isDefault).toBe(false)
    expect(list.find(v => v.id === b.id)?.isDefault).toBe(true)
  })

  it('удаление вариации обнуляет variation_id у подходов', async () => {
    const { danil, benchId } = await seedBaseline()
    const v = await addVariation(testDb, benchId, 'Гантели')
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, variationId: v.id, weight: 20, reps: 12 })

    await deleteVariation(testDb, v.id)
    const [row] = await testDb.select({ variationId: sets.variationId }).from(sets).where(eq(sets.id, s.id))
    expect(row.variationId).toBeNull()
    expect(await listVariations(testDb, benchId)).toHaveLength(0)
  })
})
