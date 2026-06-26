import { describe, it, expect } from 'vitest'
import { validateInitData } from '~~/server/utils/telegram'
import { signInitData } from './helpers/telegram'

const TOKEN = 'test-bot-token-123456'
const nowSec = Math.floor(Date.UTC(2026, 5, 26) / 1000)
const userJson = JSON.stringify({ id: 555, first_name: 'Данил', username: 'danil' })

function freshParams(authDate = nowSec) {
  return { query_id: 'AAA', user: userJson, auth_date: String(authDate) }
}

describe('validateInitData', () => {
  it('принимает корректно подписанные данные и возвращает пользователя', () => {
    const initData = signInitData(freshParams(), TOKEN)
    const user = validateInitData(initData, TOKEN, { maxAgeSec: Number.MAX_SAFE_INTEGER })
    expect(user.id).toBe(555)
    expect(user.firstName).toBe('Данил')
    expect(user.username).toBe('danil')
  })

  it('отклоняет подделанный hash', () => {
    const initData = signInitData(freshParams(), TOKEN).replace(/hash=.*/, 'hash=deadbeef')
    expect(() => validateInitData(initData, TOKEN, { maxAgeSec: Number.MAX_SAFE_INTEGER })).toThrow()
  })

  it('отклоняет чужой токен', () => {
    const initData = signInitData(freshParams(), TOKEN)
    expect(() => validateInitData(initData, 'other-token', { maxAgeSec: Number.MAX_SAFE_INTEGER })).toThrow()
  })

  it('отклоняет устаревший auth_date', () => {
    const initData = signInitData(freshParams(nowSec - 100000), TOKEN)
    expect(() => validateInitData(initData, TOKEN, { maxAgeSec: 3600 })).toThrow()
  })
})
