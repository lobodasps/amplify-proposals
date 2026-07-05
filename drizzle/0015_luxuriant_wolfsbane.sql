CREATE TABLE "provider_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"apiKey" text NOT NULL,
	"baseUrl" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"defaultModel" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_skills" ALTER COLUMN "provider" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_skills" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_skills" ADD COLUMN "providerApiKeyId" uuid;