import { beforeAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDb } from './helpers/db'

beforeAll(async () => {
  // быстрый ping — упадём понятно, если тестовая БД не мигрирована
  await testDb.execute(sql`SELECT 1`)
})
