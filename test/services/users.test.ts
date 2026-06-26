import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, resetDb } from '../helpers/db'
import { users } from '~~/server/db/schema'
import { resolveUser, isAllowed, parseAllowlist, listUsers } from '~~/server/services/users'

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
