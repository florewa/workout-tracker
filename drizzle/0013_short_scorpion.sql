ALTER TABLE "exercise_variations" ADD COLUMN "alt_exercise_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_variations" ADD CONSTRAINT "exercise_variations_alt_exercise_id_exercises_id_fk" FOREIGN KEY ("alt_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
