import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { sets, users, workoutMembers, workouts } from '~~/server/db/schema'
import { resolveUser, isAllowed, parseAllowlist, listUsers, getAvatar, setAvatar, deleteUserAccount } from '~~/server/services/users'
import { createWorkout } from '~~/server/services/workouts'
import { addSet } from '~~/server/services/sets'

beforeEach(async () => { await resetDb() })

describe('resolveUser', () => {
  it('линкует существующего seed-юзера по имени', async () => {
    await testDb.insert(users).values({ name: 'Данил' }) // seed без telegram_id
    const u = await resolveUser(testDb, { id: 999, firstName: 'Данил', username: 'danil' })
    expect(u.name).toBe('Данил')
    const rows = await testDb.select().from(users)
    expect(rows.length).toBe(1) // НЕ создан дубль
    expect(rows[0].telegramId).toBe(999)
  })

  it('возвращает уже связанного юзера по telegram_id', async () => {
    await testDb.insert(users).values({ name: 'Данил', telegramId: 999 })
    const u = await resolveUser(testDb, { id: 999, firstName: 'Данил Другой', username: null })
    expect(u.name).toBe('Данил')
    expect((await testDb.select().from(users)).length).toBe(1)
  })

  it('создаёт нового, если совпадений нет', async () => {
    const u = await resolveUser(testDb, { id: 123, firstName: 'Кирилл', username: 'kir' })
    expect(u.name).toBe('Кирилл')
    const rows = await testDb.select().from(users).where(eq(users.telegramId, 123))
    expect(rows.length).toBe(1)
  })
})

describe('listUsers', () => {
  it('возвращает всех пользователей по имени', async () => {
    await testDb.insert(users).values([{ name: 'Егор' }, { name: 'Данил' }])
    const list = await listUsers(testDb)
    expect(list.map((u) => u.name)).toEqual(['Данил', 'Егор'])
  })

  it('возвращает аватар и позволяет его обновить и удалить', async () => {
    const [user] = await testDb.insert(users).values({ name: 'Егор' }).returning({ id: users.id })
    await setAvatar(testDb, user.id, '/uploads/egor.webp')
    expect(await getAvatar(testDb, user.id)).toBe('/uploads/egor.webp')
    expect((await listUsers(testDb))[0].avatarUrl).toBe('/uploads/egor.webp')

    await setAvatar(testDb, user.id, null)
    expect(await getAvatar(testDb, user.id)).toBeNull()
  })
})

describe('allowlist', () => {
  it('пустой allowlist пускает всех', () => {
    expect(isAllowed(42, [])).toBe(true)
  })
  it('непустой allowlist пускает только своих', () => {
    expect(isAllowed(42, [1, 2, 42])).toBe(true)
    expect(isAllowed(7, [1, 2, 42])).toBe(false)
  })
  it('parseAllowlist парсит CSV в числа', () => {
    expect(parseAllowlist('1, 2 ,42')).toEqual([1, 2, 42])
    expect(parseAllowlist('')).toEqual([])
    expect(parseAllowlist(undefined)).toEqual([])
  })
})

describe('deleteUserAccount', () => {
  it('удаляет личные подходы, но сохраняет общую тренировку и данные друга', async () => {
    const { danil, egor, benchId } = await seedBaseline()
    const { id: workoutId } = await createWorkout(testDb, { createdBy: danil, memberIds: [egor], recordMode: 'single' })
    await addSet(testDb, { workoutId, userId: danil, exerciseId: benchId, weight: 60, reps: 8 })
    await addSet(testDb, { workoutId, userId: egor, exerciseId: benchId, weight: 90, reps: 8 })

    await deleteUserAccount(testDb, danil)

    expect(await testDb.select().from(users).where(eq(users.id, danil))).toHaveLength(0)
    expect(await testDb.select().from(workouts).where(eq(workouts.id, workoutId))).toHaveLength(1)
    expect((await testDb.select().from(sets).where(eq(sets.workoutId, workoutId))).map(row => row.userId)).toEqual([egor])
    expect((await testDb.select().from(workoutMembers).where(eq(workoutMembers.workoutId, workoutId))).map(row => row.userId)).toEqual([egor])
  })

  it('удаляет осиротевшую личную тренировку', async () => {
    const { danil } = await seedBaseline()
    const { id } = await createWorkout(testDb, { createdBy: danil, memberIds: [] })
    await deleteUserAccount(testDb, danil)
    expect(await testDb.select().from(workouts).where(eq(workouts.id, id))).toHaveLength(0)
  })
})
