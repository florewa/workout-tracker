import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramUser {
  id: number
  firstName: string
  username: string | null
}

export function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeSec?: number } = {},
): TelegramUser {
  const maxAgeSec = opts.maxAgeSec ?? 24 * 60 * 60
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new Error('initData: hash отсутствует')

  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key === 'hash') return
    pairs.push(`${key}=${value}`)
  })
  const dataCheckString = pairs.sort().join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computed, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('initData: неверная подпись')
  }

  const authDateRaw = params.get('auth_date')
  if (authDateRaw === null) throw new Error('initData: нет auth_date')
  const authDate = Number(authDateRaw)
  if (!Number.isFinite(authDate)) throw new Error('initData: нет auth_date')
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec > maxAgeSec) throw new Error('initData: данные устарели')

  const userRaw = params.get('user')
  if (!userRaw) throw new Error('initData: нет user')
  let u: { id: number; first_name: string; username?: string }
  try {
    u = JSON.parse(userRaw)
  } catch {
    throw new Error('initData: неверный user')
  }
  return { id: u.id, firstName: u.first_name, username: u.username ?? null }
}
