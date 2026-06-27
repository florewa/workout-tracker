import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// На проде держим пул маленьким (VPS + один инстанс Nitro)
const queryClient = postgres(connectionString, process.env.NODE_ENV === 'production' ? { max: 2 } : {})
export const db = drizzle(queryClient, { schema })
