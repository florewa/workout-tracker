CREATE TABLE IF NOT EXISTS "workout_invites" (
	"workout_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "workout_invites_workout_id_user_id_pk" PRIMARY KEY("workout_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_invites" ADD CONSTRAINT "workout_invites_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_invites" ADD CONSTRAINT "workout_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_invites_user_status_idx" ON "workout_invites" USING btree ("user_id","status");