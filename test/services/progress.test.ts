import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import { exerciseProgress } from '~~/server/services/progress'
import { e1rm } from '~~/server/utils/metrics'

beforeEach(async () => { await resetDb() })

describe('exerciseProgress', () => {
  it('берёт лучший подход первого дня против лучшего последнего', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const day1 = new Date('2026-06-01T10:00:00Z')
    const day2 = new Date('2026-06-10T10:00:00Z')
    await testDb.insert(sets).values([
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 1, weight: 60, reps: 10, createdAt: day1 },
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 2, weight: 50, reps: 5, createdAt: day1 },
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 3, weight: 70, reps: 8, createdAt: day2 },
    ])
    const prog = await exerciseProgress(testDb, danil)
    expect(prog).toHaveLength(1)
    expect(prog[0].startE1rm).toBe(e1rm(60, 10))
    expect(prog[0].nowE1rm).toBe(e1rm(70, 8))
    expect(prog[0].sessions).toBe(2)
  })

  it('пустой результат без подходов', async () => {
    const { danil } = await seedBaseline()
    expect(await exerciseProgress(testDb, danil)).toEqual([])
  })
})
