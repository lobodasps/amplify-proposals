ALTER TABLE "personnel" ADD COLUMN "employerType" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_userId_profiles_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
