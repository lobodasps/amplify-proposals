CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"damDocumentId" uuid NOT NULL,
	"chunkType" text NOT NULL,
	"content" text NOT NULL,
	"pageRef" text,
	"sectionRef" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"extractionMethod" text DEFAULT 'deterministic' NOT NULL,
	"metadata" jsonb,
	"serviceLineTags" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical" text NOT NULL,
	"displayName" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "normalized_tags_canonical_unique" UNIQUE("canonical")
);
--> statement-breakpoint
ALTER TABLE "dam_documents" ADD COLUMN "normalizedTags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "dam_documents" ADD COLUMN "chunkCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dam_documents" ADD COLUMN "chunkStatus" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "rfp_sessions" ADD COLUMN "evidenceBundles" jsonb;--> statement-breakpoint
ALTER TABLE "rfp_sessions" ADD COLUMN "scorerEvidenceInput" jsonb;