import {
  pgTable, serial, integer, bigint, varchar, text, real,
  timestamp, date, boolean, primaryKey, index, uniqueIndex, type AnyPgColumn,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
  name: varchar('name', { length: 100 }).notNull(),
  username: varchar('username', { length: 100 }),
  avatarUrl: text('avatar_url'),
  inviteToken: varchar('invite_token', { length: 64 }).unique(),
  // Напоминания о тренировке в боте (по умолчанию выкл.; включается в профиле)
  remindersEnabled: boolean('reminders_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Дружба — взаимная, одна каноническая строка на пару (userLow < userHigh)
export const friendships = pgTable('friendships', {
  userLow: integer('user_low').notNull().references(() => users.id),
  userHigh: integer('user_high').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userLow, t.userHigh] }),
}))

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  order: integer('order').notNull().default(0),
})

export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull().unique(),
  nameEn: varchar('name_en', { length: 200 }), // оригинальное англ. имя (связка с датасетом)
  muscleGroup: varchar('muscle_group', { length: 120 }), // RU-подпись «что качает»
  categoryId: integer('category_id').references((): AnyPgColumn => categories.id),
  imageUrl: text('image_url'),
  primaryMuscles: text('primary_muscles').array(), // канонические ключи мышц (для схемы/фильтра)
  secondaryMuscles: text('secondary_muscles').array(),
  equipment: varchar('equipment', { length: 60 }),
  instructions: text('instructions'),
  source: varchar('source', { length: 40 }), // 'custom' | 'free-exercise-db'
  defaultReps: varchar('default_reps', { length: 40 }),
  defaultTempo: varchar('default_tempo', { length: 20 }),
  isArchived: boolean('is_archived').notNull().default(false),
  aliasOf: integer('alias_of').references((): AnyPgColumn => exercises.id),
})

export const programDays = pgTable('program_days', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  order: integer('order').notNull(),
  weekday: integer('weekday'), // ISO weekday 1..7, nullable
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

// Расписание программ: повторяющиеся дни недели и переопределения на дату.
// Для недельной строки заполнен weekday и dayId, для даты — date, а dayId=null
// означает явно назначенный день отдыха.
export const programSchedules = pgTable('program_schedules', {
  id: serial('id').primaryKey(),
  dayId: integer('day_id').references(() => programDays.id),
  weekday: integer('weekday'),
  date: date('date', { mode: 'string' }),
}, (t) => ({
  weekdayUnique: uniqueIndex('program_schedules_weekday_unique').on(t.weekday),
  dateUnique: uniqueIndex('program_schedules_date_unique').on(t.date),
}))

export const workouts = pgTable('workouts', {
  id: serial('id').primaryKey(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  dayId: integer('day_id').references(() => programDays.id),
  note: text('note'),
  // 'each' — каждый записывает сам; 'single' — один ведёт за всех (ротация)
  recordMode: varchar('record_mode', { length: 10 }).notNull().default('each'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => ({
  dateIdx: index('workouts_date_idx').on(t.date),
}))

export const workoutMembers = pgTable('workout_members', {
  workoutId: integer('workout_id').notNull().references(() => workouts.id),
  userId: integer('user_id').notNull().references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.workoutId, t.userId] }),
}))

// При режиме «каждый сам» приглашённый подтверждает участие перед тем,
// как тренировка становится для него активной.
export const workoutInvites = pgTable('workout_invites', {
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 12 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.workoutId, t.userId] }),
  pendingIdx: index('workout_invites_user_status_idx').on(t.userId, t.status),
}))

// Вариации упражнения (один и тот же движок, разный снаряд: гантели/тренажёр)
export const exerciseVariations = pgTable('exercise_variations', {
  id: serial('id').primaryKey(),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  name: varchar('name', { length: 120 }).notNull(),
  // если задано — вариация это другое упражнение из банка (подход пишется под него)
  altExerciseId: integer('alt_exercise_id').references((): AnyPgColumn => exercises.id),
  isDefault: boolean('is_default').notNull().default(false),
})

// Базовое значение участника по упражнению — стартовая подстановка при записи
export const exerciseDefaults = pgTable('exercise_defaults', {
  userId: integer('user_id').notNull().references(() => users.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  weight: real('weight').notNull(),
  reps: integer('reps').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.exerciseId] }),
}))

export const sets = pgTable('sets', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  variationId: integer('variation_id').references(() => exerciseVariations.id),
  setOrder: integer('set_order').notNull(),
  weight: real('weight').notNull(),
  reps: integer('reps').notNull(),
  // Пропущенный подход: занимает позицию в ротации, но не идёт в статистику
  skipped: boolean('skipped').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userExerciseIdx: index('sets_user_exercise_idx').on(t.userId, t.exerciseId, t.createdAt),
  orderUnique: uniqueIndex('sets_order_unique').on(t.workoutId, t.userId, t.exerciseId, t.setOrder),
}))
