import {
  pgTable, serial, integer, bigint, varchar, text, real,
  timestamp, boolean, primaryKey,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
  name: varchar('name', { length: 100 }).notNull(),
  username: varchar('username', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull().unique(),
  muscleGroup: varchar('muscle_group', { length: 120 }),
  defaultReps: varchar('default_reps', { length: 40 }),
  defaultTempo: varchar('default_tempo', { length: 20 }),
  isArchived: boolean('is_archived').notNull().default(false),
})

export const programDays = pgTable('program_days', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  order: integer('order').notNull(),
})

export const programExercises = pgTable('program_exercises', {
  id: serial('id').primaryKey(),
  dayId: integer('day_id').notNull().references(() => programDays.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  order: integer('order').notNull(),
  targetSets: integer('target_sets'),
  targetReps: varchar('target_reps', { length: 40 }),
  tempo: varchar('tempo', { length: 20 }),
  restSec: integer('rest_sec'),
})

export const workouts = pgTable('workouts', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  dayId: integer('day_id').references(() => programDays.id),
  note: text('note'),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
})

export const workoutMembers = pgTable('workout_members', {
  workoutId: integer('workout_id').notNull().references(() => workouts.id),
  userId: integer('user_id').notNull().references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.workoutId, t.userId] }),
}))

export const sets = pgTable('sets', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  setOrder: integer('set_order').notNull(),
  weight: real('weight').notNull(),
  reps: integer('reps').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
