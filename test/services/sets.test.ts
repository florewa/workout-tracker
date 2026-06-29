import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import { addSet, deleteSet, lastSet, getSetOwnership, updateSet, reorderSets } from '~~/server/services/sets'
import { asc, eq } from 'drizzle-orm'

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

  it('getSetOwnership возвращает владельца подхода и null для несуществующего', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    expect(await getSetOwnership(testDb, s.id)).toEqual({ workoutId: wId, userId: danil })
    expect(await getSetOwnership(testDb, 999999)).toBeNull()
  })

  it('пропущенный подход не учитывается в lastSet', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 0, reps: 0, skipped: true })
    expect(await lastSet(testDb, danil, benchId)).toEqual({ weight: 60, reps: 5 })
  })

  it('updateSet меняет вес и повторы', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await updateSet(testDb, s.id, { weight: 65, reps: 3 })
    expect(await lastSet(testDb, danil, benchId)).toEqual({ weight: 65, reps: 3 })
  })

  it('reorderSets переставляет подходы и сохраняет порядок 1..n', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const a = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    const b = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 62.5, reps: 4 })
    const c = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 65, reps: 3 })

    const res = await reorderSets(testDb, [c.id, a.id, b.id])
    expect(res).toEqual({ workoutId: wId })

    const rows = await testDb
      .select({ id: sets.id, setOrder: sets.setOrder })
      .from(sets)
      .where(eq(sets.workoutId, wId))
      .orderBy(asc(sets.setOrder))
    expect(rows.map(r => r.id)).toEqual([c.id, a.id, b.id])
    expect(rows.map(r => r.setOrder)).toEqual([1, 2, 3])
  })

  it('reorderSets отклоняет неполный список группы', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const a = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 62.5, reps: 4 })
    expect(await reorderSets(testDb, [a.id])).toBeNull()
  })

  it('UNIQUE не даёт задвоить set_order в паре юзер+упражнение', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await expect(
      testDb.insert(sets).values({ workoutId: wId, userId: danil, exerciseId: benchId, setOrder: 1, weight: 50, reps: 5 }),
    ).rejects.toThrow()
  })
})
