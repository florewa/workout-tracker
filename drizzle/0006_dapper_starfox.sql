ALTER TABLE "sets" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "record_mode" varchar(10) DEFAULT 'each' NOT NULL;