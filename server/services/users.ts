import { and, eq, isNull } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import type { TelegramUser } from '~~/server/utils/telegram'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export function parseAllowlist(env: string | undefined): number[] {
  if (!env) return []
  return env.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
}

export function isAllowed(telegramId: number, allowlist: number[]): boolean {
  if (allowlist.length === 0) return true
  return allowlist.includes(telegramId)
}

export async function resolveUser(
  executor: Executor,
  tg: TelegramUser,
): Promise<{ id: number; name: string }> {
  // 1. уже связан по telegram_id
  const byTg = await executor.select().from(users).where(eq(users.telegramId, tg.id)).limit(1)
  if (byTg.length) return { id: byTg[0].id, name: byTg[0].name }

  // 2. seed-юзер с тем же именем и без telegram_id — линкуем
  const byName = await executor.select().from(users)
    .where(and(eq(users.name, tg.firstName), isNull(users.telegramId))).limit(1)
  if (byName.length) {
    await executor.update(users)
      .set({ telegramId: tg.id, username: tg.username })
      .where(eq(users.id, byName[0].id))
    return { id: byName[0].id, name: byName[0].name }
  }

  // 3. новый
  const [created] = await executor.insert(users)
    .values({ name: tg.firstName, telegramId: tg.id, username: tg.username })
    .returning({ id: users.id, name: users.name })
  return created
}
