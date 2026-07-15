CREATE TABLE IF NOT EXISTS "workout_extra_exercises" (
	"workout_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"order" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_extra_exercises_workout_id_exercise_id_pk" PRIMARY KEY("workout_id","exercise_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_extra_exercises" ADD CONSTRAINT "workout_extra_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_extra_exercises" ADD CONSTRAINT "workout_extra_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_extra_exercises_order_idx" ON "workout_extra_exercises" USING btree ("workout_id","order");