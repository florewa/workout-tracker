CREATE TABLE IF NOT EXISTS "exercise_defaults" (
	"user_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"weight" real NOT NULL,
	"reps" integer NOT NULL,
	CONSTRAINT "exercise_defaults_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_defaults" ADD CONSTRAINT "exercise_defaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_defaults" ADD CONSTRAINT "exercise_defaults_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
