import { sql } from 'drizzle-orm'
import { setHeader } from 'h3'
import { db } from '~~/server/db/client'

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const startedAt = Date.now()
  try {
    await db.execute(sql`select 1`)
    return {
      status: 'ok',
      database: 'ok',
      responseMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }
  } catch {
    setResponseStatus(event, 503)
    return {
      status: 'error',
      database: 'unavailable',
      responseMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }
  }
})
