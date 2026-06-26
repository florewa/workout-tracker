ALTER TABLE "exercises" ADD COLUMN "alias_of" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercises" ADD CONSTRAINT "exercises_alias_of_exercises_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sets_user_exercise_idx" ON "sets" USING btree ("user_id","exercise_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workouts_date_idx" ON "workouts" USING btree ("date");