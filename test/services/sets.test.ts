import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { exercises, programDays, programExercises, sets } from '~~/server/db/schema'
import { createWorkout } from '~~/server/services/workouts'
import {
  addSet, deleteSet, lastSet, getSetOwnership, updateSet, reorderSets, previousExerciseWorkout,
} from '~~/server/services/sets'
import { asc, eq } from 'drizzle-orm'
import { addVariation } from '~~/server/services/variations'

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

  it('не дублирует подход при повторе офлайн-операции', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const input = {
      workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5,
      clientRequestId: 'offline-operation-0001',
    }
    const first = await addSet(testDb, input)
    const repeated = await addSet(testDb, input)
    expect(repeated).toEqual(first)
    expect(await testDb.select().from(sets).where(eq(sets.workoutId, wId))).toHaveLength(1)
  })

  it('lastSet возвращает последний подход пользователя в упражнении', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 62.5, reps: 4 })
    const last = await lastSet(testDb, danil, benchId)
    expect(last).toEqual({ weight: 62.5, reps: 4, variationId: null })
  })

  it('lastSet возвращает null, если подходов не было', async () => {
    const { egor, benchId } = await seedBaseline()
    expect(await lastSet(testDb, egor, benchId)).toBeNull()
  })

  it('previousExerciseWorkout возвращает все подходы предыдущей тренировки', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: previousId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 60, reps: 8 })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 75, reps: 3 })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 70, reps: 4 })

    const { id: currentId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: currentId, userId: danil, exerciseId: benchId, weight: 75, reps: 3 })

    const result = await previousExerciseWorkout(testDb, danil, benchId, currentId)
    expect(result?.workoutId).toBe(previousId)
    expect(result?.sets.map(set => [set.weight, set.reps])).toEqual([
      [60, 8], [75, 3], [70, 4],
    ])
    expect(result?.bestSet).toMatchObject({ weight: 75, reps: 3 })
  })

  it('ищет историю упражнения во всех днях программы', async () => {
    const { danil, benchId, dayId } = await seedBaseline()
    const [secondDay] = await testDb.insert(programDays)
      .values({ code: 'Верх B', title: 'ДЕНЬ 2 · ВЕРХ B', order: 2 })
      .returning({ id: programDays.id })
    await testDb.insert(programExercises).values({
      dayId: secondDay.id, exerciseId: benchId, order: 1, targetSets: 3, targetReps: '8',
    })
    const { id: previousId } = await createWorkout(testDb, {
      createdBy: danil, dayId, memberIds: [], date: new Date('2026-07-01T18:00:00Z'),
    })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 70, reps: 8 })
    const { id: currentId } = await createWorkout(testDb, {
      createdBy: danil, dayId: secondDay.id, memberIds: [], date: new Date('2026-07-08T18:00:00Z'),
    })

    const result = await previousExerciseWorkout(testDb, danil, benchId, currentId)
    expect(result?.workoutId).toBe(previousId)
    expect(result?.sets.map(set => [set.weight, set.reps])).toEqual([[70, 8]])
  })

  it('не смешивает подходы участников в прошлой тренировке', async () => {
    const { danil, egor, benchId } = await seedBaseline()
    const { id: previousId } = await createWorkout(testDb, {
      createdBy: danil, memberIds: [egor], date: new Date('2026-07-01T18:00:00Z'),
    })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 70, reps: 12 })
    await addSet(testDb, { workoutId: previousId, userId: egor, exerciseId: benchId, weight: 90, reps: 12 })
    const { id: currentId } = await createWorkout(testDb, {
      createdBy: danil, memberIds: [egor], date: new Date('2026-07-08T18:00:00Z'),
    })

    const danilHistory = await previousExerciseWorkout(testDb, danil, benchId, currentId)
    const egorHistory = await previousExerciseWorkout(testDb, egor, benchId, currentId)
    expect(danilHistory?.sets.map(set => set.weight)).toEqual([70])
    expect(egorHistory?.sets.map(set => set.weight)).toEqual([90])
  })

  it('не смешивает базовое упражнение и выбранную альтернативную вариацию', async () => {
    const { danil, benchId } = await seedBaseline()
    const [dumbbells] = await testDb.insert(exercises).values({ name: 'Жим гантелей лёжа' }).returning({ id: exercises.id })
    const variation = await addVariation(testDb, benchId, 'Гантели', dumbbells.id)
    const { id: previousId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: benchId, weight: 70, reps: 8 })
    await addSet(testDb, { workoutId: previousId, userId: danil, exerciseId: dumbbells.id, variationId: variation.id, weight: 30, reps: 10 })
    const { id: currentId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })

    const base = await previousExerciseWorkout(testDb, danil, benchId, currentId, null)
    const alternative = await previousExerciseWorkout(testDb, danil, benchId, currentId, variation.id)
    expect(base?.sets.map(row => row.weight)).toEqual([70])
    expect(alternative?.sets.map(row => row.weight)).toEqual([30])
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
    expect(await lastSet(testDb, danil, benchId)).toEqual({ weight: 60, reps: 5, variationId: null })
  })

  it('updateSet меняет вес и повторы', async () => {
    const { danil, benchId } = await seedBaseline()
    const { id: wId } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    const s = await addSet(testDb, { workoutId: wId, userId: danil, exerciseId: benchId, weight: 60, reps: 5 })
    await updateSet(testDb, s.id, { weight: 65, reps: 3 })
    expect(await lastSet(testDb, danil, benchId)).toEqual({ weight: 65, reps: 3, variationId: null })
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
