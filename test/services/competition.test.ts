import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import { addFriendship } from '~~/server/services/friends'
import { competition } from '~~/server/services/competition'
import { e1rm } from '~~/server/utils/metrics'

beforeEach(async () => { await resetDb() })

describe('competition', () => {
  it('считает рост каждого участника круга от его старта', async () => {
    const { danil, egor, benchId } = await seedBaseline()
    await addFriendship(testDb, danil, egor)
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [egor] })
    const day1 = new Date('2026-06-01T10:00:00Z')
    const day2 = new Date('2026-06-20T10:00:00Z')
    await testDb.insert(sets).values([
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 1, weight: 60, reps: 8, createdAt: day1 },
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 2, weight: 70, reps: 8, createdAt: day2 },
      { workoutId: wId, userId: egor, exerciseId: benchId, setOrder: 1, weight: 50, reps: 8, createdAt: day1 },
      { workoutId: wId, userId: egor, exerciseId: benchId, setOrder: 2, weight: 55, reps: 8, createdAt: day2 },
    ])

    const res = await competition(testDb, danil, 'all')

    expect(res.participants.map(p => p.id).sort()).toEqual([danil, egor].sort())
    expect(res.exercises.map(e => e.exerciseId)).toContain(benchId)

    const board = res.byExercise[benchId].leaderboard
    const dRow = board.find(r => r.userId === danil)!
    const eRow = board.find(r => r.userId === egor)!
    expect(dRow.startE1rm).toBe(e1rm(60, 8))
    expect(dRow.currentE1rm).toBe(e1rm(70, 8))
    expect(dRow.deltaKg).toBe(Math.round((e1rm(70, 8) - e1rm(60, 8)) * 10) / 10)
    // Данил растёт быстрее в процентах — он лидер роста
    expect(dRow.deltaPct).toBeGreaterThan(eRow.deltaPct)
    expect(res.rankings.growth[0].userId).toBe(danil)
    // Тяжеловес — тоже Данил (выше абсолютный e1RM)
    expect(res.rankings.heaviest[0].userId).toBe(danil)
  })

  it('исключает участников без активности в периоде', async () => {
    const { danil, egor, benchId } = await seedBaseline()
    await addFriendship(testDb, danil, egor)
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [egor] })
    // Только Данил тренировался недавно
    await testDb.insert(sets).values([
      { workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 1, weight: 60, reps: 8, createdAt: new Date() },
    ])

    const res = await competition(testDb, danil, '1m')
    const board = res.byExercise[benchId]?.leaderboard ?? []
    expect(board.map(r => r.userId)).toEqual([danil])
  })
})
