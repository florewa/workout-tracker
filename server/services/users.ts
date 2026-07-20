import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import {
  exerciseDefaults, favoriteExercises, friendships, sets, users, workoutExtraExercises,
  workoutInvites, workoutMembers, workouts,
} from '~~/server/db/schema'
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
  const existing = byTg[0]
  if (existing) return { id: existing.id, name: existing.name, avatarUrl: existing.avatarUrl }

  // 2. seed-юзер с тем же именем и без telegram_id — линкуем
  const byName = await executor.select().from(users)
    .where(and(eq(users.name, tg.firstName), isNull(users.telegramId))).limit(1)
  const seedUser = byName[0]
  if (seedUser) {
    await executor.update(users)
      .set({ telegramId: tg.id, username: tg.username })
      .where(eq(users.id, seedUser.id))
    return { id: seedUser.id, name: seedUser.name, avatarUrl: seedUser.avatarUrl }
  }

  // 3. новый
  const [created] = await executor.insert(users)
    .values({ name: tg.firstName, telegramId: tg.id, username: tg.username })
    .returning({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
  if (!created) throw new Error('Пользователь не создан')
  return created
}

export async function getAvatar(executor: Executor, userId: number): Promise<string | null> {
  const [row] = await executor.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.avatarUrl ?? null
}

export async function setAvatar(executor: Executor, userId: number, avatarUrl: string | null): Promise<void> {
  await executor.update(users).set({ avatarUrl }).where(eq(users.id, userId))
}

export async function deleteUserAccount(executor: Executor, userId: number): Promise<void> {
  await executor.transaction(async (tx) => {
    const memberships = await tx.select({ workoutId: workoutMembers.workoutId })
      .from(workoutMembers).where(eq(workoutMembers.userId, userId))

    await tx.delete(friendships).where(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)))
    await tx.delete(favoriteExercises).where(eq(favoriteExercises.userId, userId))
    await tx.delete(exerciseDefaults).where(eq(exerciseDefaults.userId, userId))
    await tx.delete(workoutInvites).where(eq(workoutInvites.userId, userId))
    await tx.delete(sets).where(eq(sets.userId, userId))
    await tx.delete(workoutMembers).where(eq(workoutMembers.userId, userId))
    await tx.update(workouts).set({ createdBy: null }).where(eq(workouts.createdBy, userId))

    // Личные тренировки без оставшихся участников больше никому не принадлежат.
    for (const { workoutId } of memberships) {
      const [memberCount] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(workoutMembers).where(eq(workoutMembers.workoutId, workoutId))
      if ((memberCount?.count ?? 0) > 0) continue
      await tx.delete(sets).where(eq(sets.workoutId, workoutId))
      await tx.delete(workoutInvites).where(eq(workoutInvites.workoutId, workoutId))
      await tx.delete(workoutExtraExercises).where(eq(workoutExtraExercises.workoutId, workoutId))
      await tx.delete(workouts).where(eq(workouts.id, workoutId))
    }
    await tx.delete(users).where(eq(users.id, userId))
  })
}
