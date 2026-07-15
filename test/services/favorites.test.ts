import { beforeEach, describe, expect, it } from 'vitest'
import { exercises } from '~~/server/db/schema'
import { listFavoriteExercises, setExerciseFavorite } from '~~/server/services/favorites'
import { resetDb, seedBaseline, testDb } from '../helpers/db'

beforeEach(async () => { await resetDb() })

describe('favorite exercises', () => {
  it('хранит избранное отдельно для каждого пользователя', async () => {
    const { danil, egor, benchId } = await seedBaseline()
    await setExerciseFavorite(testDb, danil, benchId, true)

    expect(await listFavoriteExercises(testDb, danil)).toEqual([
      { exerciseId: benchId, name: 'Жим штанги лёжа' },
    ])
    expect(await listFavoriteExercises(testDb, egor)).toEqual([])
  })

  it('сохраняет каноническое упражнение и умеет удалять его из избранного', async () => {
    const { danil, benchId } = await seedBaseline()
    const [aliasExercise] = await testDb.insert(exercises)
      .values({ name: 'Жим лёжа (дубль)', aliasOf: benchId })
      .returning({ id: exercises.id })

    await setExerciseFavorite(testDb, danil, aliasExercise.id, true)
    await setExerciseFavorite(testDb, danil, aliasExercise.id, true)
    expect(await listFavoriteExercises(testDb, danil)).toHaveLength(1)

    await setExerciseFavorite(testDb, danil, aliasExercise.id, false)
    expect(await listFavoriteExercises(testDb, danil)).toEqual([])
  })
})
