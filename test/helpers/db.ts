import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from '~~/server/db/schema'

const url = process.env.DATABASE_URL_TEST
if (!url) throw new Error('DATABASE_URL_TEST is not set')

const client = postgres(url, { max: 1 })
export const testDb = drizzle(client, { schema })

export async function resetDb(): Promise<void> {
  await testDb.execute(sql`
    TRUNCATE TABLE sets, workout_members, workouts, program_exercises,
      program_days, exercises, users RESTART IDENTITY CASCADE
  `)
}

export async function seedBaseline() {
  const [danil] = await testDb.insert(schema.users).values({ name: 'Данил' }).returning({ id: schema.users.id })
  const [egor] = await testDb.insert(schema.users).values({ name: 'Егор' }).returning({ id: schema.users.id })
  const [bench] = await testDb.insert(schema.exercises).values({ name: 'Жим штанги лёжа' }).returning({ id: schema.exercises.id })
  const [day] = await testDb.insert(schema.programDays)
    .values({ code: 'Верх A', title: 'ДЕНЬ 1 · ВЕРХ A', order: 1 })
    .returning({ id: schema.programDays.id })
  await testDb.insert(schema.programExercises).values({
    dayId: day.id, exerciseId: bench.id, order: 1, targetSets: 5, targetReps: '5,5,3,3,2',
  })
  return { danil: danil.id, egor: egor.id, benchId: bench.id, dayId: day.id }
}
