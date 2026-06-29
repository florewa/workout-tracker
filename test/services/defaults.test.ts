import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { createWorkout } from '~~/server/services/workouts'
import { addSet } from '~~/server/services/sets'
import { setDefault, getDefault, prefillValue } from '~~/server/services/defaults'

beforeEach(async () => { await resetDb() })

describe('defaults', () => {
  it('setDefault/getDefault сохраняет и обновляет базу', async () => {
    const { danil, benchId } = await seedBaseline()
    await setDefault(testDb, danil, benchId, 50, 8)
    expect(await getDefault(testDb, danil, benchId)).toEqual({ weight: 50, reps: 8 })
    await setDefault(testDb, danil, benchId, 55, 6)
    expect(await getDefault(testDb, danil, benchId)).toEqual({ weight: 55, reps: 6 })
  })

  it('prefill: база при отсутствии истории, последний подход — приоритетнее', async () => {
    const { danil, benchId } = await seedBaseline()
    await setDefault(testDb, danil, benchId, 50, 8)
    expect(await prefillValue(testDb, danil, benchId)).toEqual({ weight: 50, reps: 8, variationId: null, source: 'default' })

    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    expect(await prefillValue(testDb, danil, benchId)).toEqual({ weight: 60, reps: 5, variationId: null, source: 'last' })
  })

  it('prefill: null без базы и истории', async () => {
    const { egor, benchId } = await seedBaseline()
    expect(await prefillValue(testDb, egor, benchId)).toBeNull()
  })
})
