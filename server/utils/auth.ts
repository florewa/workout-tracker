import { eq } from 'drizzle-orm'
import { createError, getHeader, type H3Event } from 'h3'
import { db } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { validateInitData } from '~~/server/utils/telegram'
import { resolveUser, isAllowed, parseAllowlist } from '~~/server/services/users'

export async function requireUser(event: H3Event): Promise<{ id: number; name: string }> {
  // Dev-обход (только не в production)
  const devId = process.env.AUTH_DEV_USER_ID
  if (devId && process.env.NODE_ENV !== 'production') {
    const [u] = await db.select().from(users).where(eq(users.id, Number(devId))).limit(1)
    if (!u) throw createError({ statusCode: 500, statusMessage: `AUTH_DEV_USER_ID=${devId}: пользователь не найден` })
    return { id: u.id, name: u.name }
  }

  const header = getHeader(event, 'authorization') ?? ''
  const initData = header.startsWith('tma ') ? header.slice(4) : ''
  if (!initData) throw createError({ statusCode: 401, statusMessage: 'Нет авторизации' })

  const token = process.env.BOT_TOKEN
  if (!token) throw createError({ statusCode: 500, statusMessage: 'BOT_TOKEN не задан' })

  let tg
  try {
    tg = validateInitData(initData, token)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные авторизации' })
  }

  if (!isAllowed(tg.id, parseAllowlist(process.env.ALLOWLIST))) {
    throw createError({ statusCode: 403, statusMessage: 'Доступ закрыт' })
  }

  return resolveUser(db, tg)
}
