CREATE TABLE IF NOT EXISTS "workout_plan_exercises" (
	"workout_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"exercise_name" varchar(200) NOT NULL,
	"order" integer NOT NULL,
	"target_sets" integer,
	"target_reps" varchar(40),
	"tempo" varchar(20),
	"rest_sec" integer,
	"weight_step" real NOT NULL,
	CONSTRAINT "workout_plan_exercises_workout_id_exercise_id_pk" PRIMARY KEY("workout_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN "client_request_id" varchar(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_plan_exercises_order_idx" ON "workout_plan_exercises" USING btree ("workout_id","order");--> statement-breakpoint
INSERT INTO "workout_plan_exercises" (
	"workout_id", "exercise_id", "exercise_name", "order", "target_sets",
	"target_reps", "tempo", "rest_sec", "weight_step"
)
SELECT
	w."id", pe."exercise_id", e."name", pe."order", pe."target_sets",
	pe."target_reps", pe."tempo", pe."rest_sec", e."weight_step"
FROM "workouts" w
JOIN "program_exercises" pe ON pe."day_id" = w."day_id"
JOIN "exercises" e ON e."id" = pe."exercise_id"
ON CONFLICT ("workout_id", "exercise_id") DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sets_client_request_unique" ON "sets" USING btree ("user_id","client_request_id");
