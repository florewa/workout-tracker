import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { createWorkout } from '~~/server/services/workouts'
import { addSet, deleteSet, lastSet } from '~~/server/services/sets'

beforeEach(async () => { await resetDb() })

describe('sets', () => {
  it('addSet нумерует подходы по порядку для пары юзер+упражнение', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s1 = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    const s2 = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    expect(s1.setOrder).toBe(1)
    expect(s2.setOrder).toBe(2)
  })

  it('lastSet возвращает последний подход пользователя в упражнении', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 62.5, reps: 4 })
    const last = await lastSet(testDb, danil, benchId)
    expect(last).toEqual({ weight: 62.5, reps: 4 })
  })

  it('lastSet возвращает null, если подходов не было', async () => {
    const { egor, benchId } = await seedBaseline()
    expect(await lastSet(testDb, egor, benchId)).toBeNull()
  })

  it('deleteSet удаляет подход', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await deleteSet(testDb, s.id)
    expect(await lastSet(testDb, danil, benchId)).toBeNull()
  })
})
