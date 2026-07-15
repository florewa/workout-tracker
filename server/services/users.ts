import { and, asc, eq, isNull } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import type { TelegramUser } from '~~/server/utils/telegram'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

export async function listUsers(executor: Executor): Promise<{ id: number; name: string; avatarUrl: string | null }[]> {
  return executor
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .orderBy(asc(users.name))
}

export function parseAllowlist(env: string | undefined): number[] {
  if (!env) return []
  return env.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
}

export function isAllowed(telegramId: number, allowlist: number[]): boolean {
  if (allowlist.length === 0) return true
  return allowlist.includes(telegramId)
}

export async function resolveUser(
  executor: Executor,
  tg: TelegramUser,
): Promise<{ id: number; name: string; avatarUrl: string | null }> {
  // 1. уже связан по telegram_id
  const byTg = await executor.select().from(users).where(eq(users.telegramId, tg.id)).limit(1)
  if (byTg.length) return { id: byTg[0].id, name: byTg[0].name, avatarUrl: byTg[0].avatarUrl }

  // 2. seed-юзер с тем же именем и без telegram_id — линкуем
  const byName = await executor.select().from(users)
    .where(and(eq(users.name, tg.firstName), isNull(users.telegramId))).limit(1)
  if (byName.length) {
    await executor.update(users)
      .set({ telegramId: tg.id, username: tg.username })
      .where(eq(users.id, byName[0].id))
    return { id: byName[0].id, name: byName[0].name, avatarUrl: byName[0].avatarUrl }
  }

  // 3. новый
  const [created] = await executor.insert(users)
    .values({ name: tg.firstName, telegramId: tg.id, username: tg.username })
    .returning({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
  return created
}

export async function getAvatar(executor: Executor, userId: number): Promise<string | null> {
  const [row] = await executor.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.avatarUrl ?? null
}

export async function setAvatar(executor: Executor, userId: number, avatarUrl: string | null): Promise<void> {
  await executor.update(users).set({ avatarUrl }).where(eq(users.id, userId))
}
