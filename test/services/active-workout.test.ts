import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { workouts } from '~~/server/db/schema'
import {
  createWorkout, getActiveWorkout, isWorkoutMember, listPendingWorkoutInvites, respondToWorkoutInvite,
} from '~~/server/services/workouts'

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

  it('не делает приглашение активным до подтверждения', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, {
      createdBy: danil,
      memberIds: [egor],
      recordMode: 'each',
    })

    expect(await getActiveWorkout(testDb, egor)).toBeNull()
    const invites = await listPendingWorkoutInvites(testDb, egor)
    expect(invites).toHaveLength(1)
    expect(invites[0]).toMatchObject({ workoutId: id, inviterName: 'Данил' })
  })

  it('делает тренировку активной после принятия приглашения', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, {
      createdBy: danil,
      memberIds: [egor],
      recordMode: 'each',
    })

    expect(await respondToWorkoutInvite(testDb, id, egor, true)).toBe(true)
    expect((await getActiveWorkout(testDb, egor))?.id).toBe(id)
    expect(await listPendingWorkoutInvites(testDb, egor)).toHaveLength(0)
  })

  it('убирает участника после отказа от приглашения', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, {
      createdBy: danil,
      memberIds: [egor],
      recordMode: 'each',
    })

    expect(await respondToWorkoutInvite(testDb, id, egor, false)).toBe(true)
    expect(await isWorkoutMember(testDb, id, egor)).toBe(false)
    expect(await listPendingWorkoutInvites(testDb, egor)).toHaveLength(0)
  })

  it('режим «я за всех» не требует подтверждения', async () => {
    const { danil, egor } = await seedBaseline()
    const { id } = await createWorkout(testDb, {
      createdBy: danil,
      memberIds: [egor],
      recordMode: 'single',
    })

    expect((await getActiveWorkout(testDb, egor))?.id).toBe(id)
    expect(await listPendingWorkoutInvites(testDb, egor)).toHaveLength(0)
  })
})
