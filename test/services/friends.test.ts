import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb, seedBaseline } from '../helpers/db'
import { users } from '~~/server/db/schema'
import {
  addFriendship, listFriends, getOrCreateInviteToken, acceptInvite, removeFriend,
} from '~~/server/services/friends'

beforeEach(async () => { await resetDb() })

describe('addFriendship / listFriends', () => {
  it('дружба взаимная и видна с обеих сторон', async () => {
    const { danil, egor } = await seedBaseline()
    await addFriendship(testDb, danil, egor)
    expect((await listFriends(testDb, danil)).map(f => f.id)).toEqual([egor])
    expect((await listFriends(testDb, egor)).map(f => f.id)).toEqual([danil])
  })

  it('не дублируется при повторе и игнорирует самого себя', async () => {
    const { danil, egor } = await seedBaseline()
    await addFriendship(testDb, danil, egor)
    await addFriendship(testDb, egor, danil)
    await addFriendship(testDb, danil, danil)
    expect(await listFriends(testDb, danil)).toHaveLength(1)
  })

  it('пустой список без друзей', async () => {
    const { danil } = await seedBaseline()
    expect(await listFriends(testDb, danil)).toEqual([])
  })
})

describe('getOrCreateInviteToken', () => {
  it('создаёт токен один раз и возвращает тот же', async () => {
    const { danil } = await seedBaseline()
    const t1 = await getOrCreateInviteToken(testDb, danil)
    const t2 = await getOrCreateInviteToken(testDb, danil)
    expect(t1).toBeTruthy()
    expect(t1).toBe(t2)
  })
})

describe('acceptInvite', () => {
  it('по токену делает друзьями и возвращает приглашающего', async () => {
    const { danil, egor } = await seedBaseline()
    const token = await getOrCreateInviteToken(testDb, danil)
    const inviter = await acceptInvite(testDb, token, egor)
    expect(inviter?.id).toBe(danil)
    expect((await listFriends(testDb, egor)).map(f => f.id)).toEqual([danil])
  })

  it('null для неизвестного токена', async () => {
    const { egor } = await seedBaseline()
    expect(await acceptInvite(testDb, 'нет-такого', egor)).toBeNull()
  })

  it('null если приглашаешь сам себя', async () => {
    const { danil } = await seedBaseline()
    const token = await getOrCreateInviteToken(testDb, danil)
    expect(await acceptInvite(testDb, token, danil)).toBeNull()
  })
})

describe('removeFriend', () => {
  it('убирает дружбу с обеих сторон', async () => {
    const { danil, egor } = await seedBaseline()
    await addFriendship(testDb, danil, egor)
    await removeFriend(testDb, egor, danil)
    expect(await listFriends(testDb, danil)).toEqual([])
    expect(await listFriends(testDb, egor)).toEqual([])
  })
})
