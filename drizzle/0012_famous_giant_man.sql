CREATE TABLE IF NOT EXISTS "exercise_variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN "variation_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercise_variations" ADD CONSTRAINT "exercise_variations_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sets" ADD CONSTRAINT "sets_variation_id_exercise_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."exercise_variations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
