import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { workouts } from '~~/server/db/schema'
import { createWorkout, getActiveWorkout } from '~~/server/services/workouts'

beforeEach(async () => { await resetDb() })

describe('getActiveWorkout', () => {
  it('returns the workout when freshly created', async () => {
    const { danil } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const result = await getActiveWorkout(testDb, danil)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(id)
  })

  it('returns null after workout is finished', async () => {
    const { danil } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await testDb.update(workouts).set({ finishedAt: new Date() }).where(eq(workouts.id, id))
    const result = await getActiveWorkout(testDb, danil)
    expect(result).toBeNull()
  })

  it('returns null when workout is stale (started 2 days ago)', async () => {
    const { danil } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await testDb.update(workouts).set({ startedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) }).where(eq(workouts.id, id))
    const result = await getActiveWorkout(testDb, danil)
    expect(result).toBeNull()
  })

  it('returns null for a non-member user', async () => {
    const { danil, egor } = await seedBaseline()
    await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const result = await getActiveWorkout(testDb, egor)
    expect(result).toBeNull()
  })
})
