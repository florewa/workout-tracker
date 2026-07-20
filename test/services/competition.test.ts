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
    const days = [1, 5, 10, 20].map(day => new Date(`2026-06-${String(day).padStart(2, '0')}T10:00:00Z`))
    await testDb.insert(sets).values([
      ...[60, 62, 69, 70].map((weight, index) => ({
        workoutId: wId, userId: danil, exerciseId: benchId, setOrder: index + 1, weight, reps: 8, createdAt: days[index],
      })),
      ...[100, 101, 104, 105].map((weight, index) => ({
        workoutId: wId, userId: egor, exerciseId: benchId, setOrder: index + 5, weight, reps: 8, createdAt: days[index],
      })),
    ])

    const res = await competition(testDb, danil, 'all')

    expect(res.participants.map(p => p.id).sort()).toEqual([danil, egor].sort())
    expect(res.exercises.map(e => e.exerciseId)).toContain(benchId)

    const board = res.byExercise[benchId].leaderboard
    const dRow = board.find(r => r.userId === danil)!
    const eRow = board.find(r => r.userId === egor)!
    expect(dRow.startE1rm).toBe(Math.round(((e1rm(60, 8) + e1rm(62, 8)) / 2) * 10) / 10)
    expect(dRow.currentE1rm).toBe(Math.round(((e1rm(69, 8) + e1rm(70, 8)) / 2) * 10) / 10)
    expect(dRow.eligible).toBe(true)
    expect(dRow.observations).toBe(4)
    // Данил растёт быстрее относительно собственного старта, хотя абсолютный вес Егора выше.
    expect(dRow.deltaPct).toBeGreaterThan(eRow.deltaPct)
    expect(res.rankings.growth[0].userId).toBe(danil)
    expect(res.rankings.growth[0].exerciseCount).toBe(1)
    expect(res.sharedExerciseIds).toEqual([benchId])
    expect(res.minimumObservations).toBe(4)
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
    expect(board[0].eligible).toBe(false)
    expect(res.sharedExerciseIds).toEqual([])
    expect(res.rankings.growth).toEqual([])
  })
})
