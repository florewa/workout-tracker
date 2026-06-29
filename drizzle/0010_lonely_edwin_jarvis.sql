ALTER TABLE "exercises" ADD COLUMN "name_en" varchar(200);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "primary_muscles" text[];--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "secondary_muscles" text[];--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "equipment" varchar(60);--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source" varchar(40);