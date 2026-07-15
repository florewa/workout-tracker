import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { users } from '~~/server/db/schema'
import {
  createWorkout, listWorkouts, getWorkout, addMember, respondToWorkoutInvite,
  calculateExerciseDurations,
} from '~~/server/services/workouts'

beforeEach(async () => { await resetDb() })

describe('workouts', () => {
  it('createWorkout добавляет создателя в участники', async () => {
    const { danil, dayId } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, dayId, memberIds: [] })
    const res = await getWorkout(testDb, id)
    expect(res!.members.map((m) => m.id)).toContain(danil)
  })

  it('createWorkout добавляет указанных участников без дублей', async () => {
    const { danil, egor, dayId } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, dayId, memberIds: [danil, egor] })
    const res = await getWorkout(testDb, id)
    expect(res!.members.length).toBe(2)
  })

  it('listWorkouts отдаёт по убыванию даты с числом участников', async () => {
    const { danil, egor } = await seedBaseline()
    await createWorkout(testDb, { createdBy: danil, memberIds: [egor], date: new Date('2026-06-22') })
    await createWorkout(testDb, { createdBy: danil, memberIds: [], date: new Date('2026-06-25') })
    const list = await listWorkouts(testDb)
    expect(list[0].date >= list[1].date).toBe(true)
    expect(list.find((w) => w.memberCount === 2)).toBeTruthy()
  })

  it('addMember идемпотентен', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addMember(testDb, id, egor)
    await addMember(testDb, id, egor)
    const res = await getWorkout(testDb, id)
    expect(res!.members.length).toBe(2)
  })

  it('возвращает аватары участников', async () => {
    const { danil } = await seedBaseline()
    await testDb.update(users).set({ avatarUrl: '/uploads/danil.png' }).where(eq(users.id, danil))
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const res = await getWorkout(testDb, id)
    expect(res!.members[0].avatarUrl).toBe('/uploads/danil.png')
  })

  it('не показывает приглашённому тренировку в истории до принятия', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, {
      createdBy: danil,
      memberIds: [egor],
      recordMode: 'each',
    })

    expect(await listWorkouts(testDb, { memberId: egor })).toHaveLength(0)
    await respondToWorkoutInvite(testDb, id, egor, true)
    expect(await listWorkouts(testDb, { memberId: egor })).toHaveLength(1)
  })

  it('считает интервалы упражнений отдельно для каждого участника', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 6, 15, 18, minutes))
    const durations = calculateExerciseDurations([
      { id: 1, userId: 1, slotExerciseId: 10, createdAt: at(0) },
      { id: 2, userId: 2, slotExerciseId: 10, createdAt: at(2) },
      { id: 3, userId: 1, slotExerciseId: 10, createdAt: at(5) },
      { id: 4, userId: 2, slotExerciseId: 20, createdAt: at(8) },
      { id: 5, userId: 1, slotExerciseId: 20, createdAt: at(10) },
    ], at(20))

    expect(durations.map(({ userId, exerciseId, durationSeconds }) => ({ userId, exerciseId, durationSeconds }))).toEqual([
      { userId: 1, exerciseId: 10, durationSeconds: 600 },
      { userId: 1, exerciseId: 20, durationSeconds: 600 },
      { userId: 2, exerciseId: 10, durationSeconds: 360 },
      { userId: 2, exerciseId: 20, durationSeconds: 720 },
    ])
  })

  it('суммирует время при возврате к упражнению', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 6, 15, 18, minutes))
    const durations = calculateExerciseDurations([
      { id: 1, userId: 1, slotExerciseId: 10, createdAt: at(0) },
      { id: 2, userId: 1, slotExerciseId: 20, createdAt: at(5) },
      { id: 3, userId: 1, slotExerciseId: 10, createdAt: at(10) },
    ], at(15))

    expect(durations.find(item => item.exerciseId === 10)?.durationSeconds).toBe(600)
    expect(durations.find(item => item.exerciseId === 20)?.durationSeconds).toBe(300)
  })
})
