CREATE TABLE IF NOT EXISTS "program_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer,
	"weekday" integer,
	"date" date
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "program_schedules" ADD CONSTRAINT "program_schedules_day_id_program_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."program_days"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "program_schedules_weekday_unique" ON "program_schedules" USING btree ("weekday");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "program_schedules_date_unique" ON "program_schedules" USING btree ("date");--> statement-breakpoint
INSERT INTO "program_schedules" ("day_id", "weekday")
SELECT DISTINCT ON ("weekday") "id", "weekday"
FROM "program_days"
WHERE "weekday" IS NOT NULL
ORDER BY "weekday", "order"
ON CONFLICT ("weekday") DO NOTHING;
