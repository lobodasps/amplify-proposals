CREATE TABLE "llm_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillType" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tokensIn" integer DEFAULT 0 NOT NULL,
	"tokensOut" integer DEFAULT 0 NOT NULL,
	"estimatedCost" numeric(10, 6),
	"durationMs" integer,
	"success" boolean DEFAULT true NOT NULL,
	"errorMessage" text,
	"userId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rfp_sessions" ADD COLUMN "uploadedFiles" jsonb;