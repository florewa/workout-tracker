import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { workouts, workoutMembers, sets } from '~~/server/db/schema'
import {
  createWorkout, isWorkoutMember, countWorkoutSets, finishWorkout, deleteWorkout,
} from '~~/server/services/workouts'

beforeEach(async () => { await resetDb() })

describe('isWorkoutMember', () => {
  it('true for a member, false for an outsider', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    expect(await isWorkoutMember(testDb, id, danil)).toBe(true)
    expect(await isWorkoutMember(testDb, id, egor)).toBe(false)
  })
})

describe('countWorkoutSets', () => {
  it('counts recorded sets', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    expect(await countWorkoutSets(testDb, id)).toBe(0)
    await testDb.insert(sets).values({ workoutId: id, userId: danil, exerciseId: benchId, setOrder: 1, weight: 60, reps: 5 })
    expect(await countWorkoutSets(testDb, id)).toBe(1)
  })
})

describe('finishWorkout', () => {
  it('stamps finishedAt', async () => {
    const { danil } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await finishWorkout(testDb, id)
    const [w] = await testDb.select().from(workouts).where(eq(workouts.id, id))
    expect(w.finishedAt).not.toBeNull()
  })
})

describe('deleteWorkout', () => {
  it('removes the workout and its members', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [egor] })
    await deleteWorkout(testDb, id)
    expect(await testDb.select().from(workouts).where(eq(workouts.id, id))).toHaveLength(0)
    expect(await testDb.select().from(workoutMembers).where(eq(workoutMembers.workoutId, id))).toHaveLength(0)
  })
})
