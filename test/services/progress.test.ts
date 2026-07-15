import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets, exercises } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import { exerciseProgress } from '~~/server/services/progress'
import { setExerciseFavorite } from '~~/server/services/favorites'
import { e1rm } from '~~/server/utils/metrics'

beforeEach(async () => { await resetDb() })

describe('exerciseProgress', () => {
  it('строит ряд по дням: лучший e1RM и объём за день', async () => {
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
    expect(prog[0].sessions).toBe(2)
    expect(prog[0].points.map(p => p.date)).toEqual(['2026-06-01', '2026-06-10'])
    expect(prog[0].points[0].e1rm).toBe(e1rm(60, 10))
    expect(prog[0].points[1].e1rm).toBe(e1rm(70, 8))
    expect(prog[0].best).toBe(e1rm(70, 8))
    expect(prog[0].points[0].volume).toBe(850)
    expect(prog[0].isFavorite).toBe(false)
  })

  it('пустой результат без подходов', async () => {
    const { danil } = await seedBaseline()
    expect(await exerciseProgress(testDb, danil)).toEqual([])
  })

  it('сводит подходы алиаса к каноническому упражнению', async () => {
    const { danil, benchId } = await seedBaseline()
    const [aliasEx] = await testDb.insert(exercises)
      .values({ name: 'Жим лёжа (вариант)', aliasOf: benchId })
      .returning({ id: exercises.id })
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await testDb.insert(sets).values([
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 1, weight: 60, reps: 8, createdAt: new Date('2026-06-01T10:00:00Z') },
      { workoutId: wId, userId: danil, exerciseId: aliasEx.id, setOrder: 1, weight: 65, reps: 8, createdAt: new Date('2026-06-08T10:00:00Z') },
    ])
    const prog = await exerciseProgress(testDb, danil)
    expect(prog).toHaveLength(1)
    expect(prog[0].exerciseId).toBe(benchId)
    expect(prog[0].sessions).toBe(2)
  })

  it('ставит избранные упражнения первыми и возвращает их даже без подходов', async () => {
    const { danil, benchId } = await seedBaseline()
    const [squat] = await testDb.insert(exercises)
      .values({ name: 'Приседания' })
      .returning({ id: exercises.id })
    await setExerciseFavorite(testDb, danil, squat.id, true)

    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await testDb.insert(sets).values({
      workoutId: wId,
      userId: danil,
      exerciseId: benchId,
      setOrder: 1,
      weight: 60,
      reps: 8,
    })

    const prog = await exerciseProgress(testDb, danil)
    expect(prog.map(item => item.exerciseId)).toEqual([squat.id, benchId])
    expect(prog[0]).toMatchObject({ isFavorite: true, sessions: 0, best: 0, points: [] })
  })
})
