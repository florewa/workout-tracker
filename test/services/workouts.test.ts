import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { createWorkout, listWorkouts, getWorkout, addMember } from '~~/server/services/workouts'

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
})
