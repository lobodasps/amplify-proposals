ALTER TABLE "firm_settings" ADD COLUMN "legalName" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "foundingYear" integer;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "employeeCount" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "geographicFocus" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "dbeCertification" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "mbeCertification" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "wbeCertification" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "certificationDetails" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "naicsCodes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "ueiNumber" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "dunsNumber" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "stateRegistrations" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "boilerplateFirmDescription" text;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "differentiators" jsonb DEFAULT '[]'::jsonb;