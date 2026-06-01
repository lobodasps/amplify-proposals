CREATE TABLE "firm_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firmName" text,
	"serviceLines" jsonb DEFAULT '[]'::jsonb,
	"states" jsonb DEFAULT '[]'::jsonb,
	"typicalValueMin" numeric,
	"typicalValueMax" numeric,
	"minDaysToRespond" integer DEFAULT 14,
	"preferredAgencies" jsonb DEFAULT '[]'::jsonb,
	"avoidedAgencies" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
