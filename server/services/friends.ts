import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, or } from 'drizzle-orm'
import type { db as dbType } from '~~/server/db/client'
import { users, friendships } from '~~/server/db/schema'

type Executor = typeof dbType | Parameters<Parameters<typeof dbType.transaction>[0]>[0]

function pair(a: number, b: number): { low: number; high: number } {
  return a < b ? { low: a, high: b } : { low: b, high: a }
}

export async function addFriendship(executor: Executor, a: number, b: number): Promise<void> {
  if (a === b) return
  const { low, high } = pair(a, b)
  await executor.insert(friendships).values({ userLow: low, userHigh: high }).onConflictDoNothing()
}

export async function listFriends(executor: Executor, userId: number): Promise<{ id: number; name: string }[]> {
  const rows = await executor
    .select({ low: friendships.userLow, high: friendships.userHigh })
    .from(friendships)
    .where(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)))
  const ids = rows.map((r) => (r.low === userId ? r.high : r.low))
  if (!ids.length) return []
  return executor
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.name))
}

export async function getOrCreateInviteToken(executor: Executor, userId: number): Promise<string> {
  const [u] = await executor.select({ token: users.inviteToken }).from(users).where(eq(users.id, userId)).limit(1)
  if (u?.token) return u.token
  const token = randomUUID()
  await executor.update(users).set({ inviteToken: token }).where(eq(users.id, userId))
  return token
}

/** Делает текущего пользователя другом владельца токена. Возвращает приглашающего или null. */
export async function acceptInvite(
  executor: Executor,
  token: string,
  meId: number,
): Promise<{ id: number; name: string } | null> {
  const [inviter] = await executor
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.inviteToken, token))
    .limit(1)
  if (!inviter || inviter.id === meId) return null
  await addFriendship(executor, meId, inviter.id)
  return inviter
}

export async function removeFriend(executor: Executor, userId: number, friendId: number): Promise<void> {
  const { low, high } = pair(userId, friendId)
  await executor.delete(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
}
