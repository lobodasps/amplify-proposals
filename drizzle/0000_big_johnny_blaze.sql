CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"changedFields" jsonb,
	"userId" uuid,
	"userName" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_guidelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillType" text NOT NULL,
	"proposalId" uuid,
	"pursuitId" uuid,
	"sectionName" text,
	"successCriteria" text,
	"approaches" text,
	"chosenApproachIndex" integer,
	"choiceRationale" text,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillType" text NOT NULL,
	"displayName" text NOT NULL,
	"description" text,
	"provider" text DEFAULT 'manus_builtin' NOT NULL,
	"model" text,
	"apiKey" text,
	"baseUrl" text,
	"systemPrompt" text NOT NULL,
	"userPromptTemplate" text NOT NULL,
	"templateVariables" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_skills_skillType_unique" UNIQUE("skillType")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"description" text,
	"updatedBy" uuid,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"fileKey" text NOT NULL,
	"fileUrl" text NOT NULL,
	"mimeType" text,
	"fileSize" integer,
	"assetType" text DEFAULT 'document',
	"folder" text DEFAULT 'root',
	"tags" jsonb,
	"serviceLines" jsonb,
	"projectId" uuid,
	"staffId" uuid,
	"version" integer DEFAULT 1,
	"parentAssetId" uuid,
	"uploadedBy" uuid,
	"isPublic" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractId" uuid NOT NULL,
	"invoiceNumber" text,
	"invoiceDate" timestamp with time zone,
	"amount" numeric DEFAULT '0' NOT NULL,
	"billedAmount" numeric DEFAULT '0',
	"retainageAmount" numeric DEFAULT '0',
	"description" text,
	"source" text DEFAULT 'manual',
	"qbInvoiceId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amp_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'public_agency',
	"state" text DEFAULT 'NY',
	"city" text,
	"contactName" text,
	"contactEmail" text,
	"contactPhone" text,
	"notes" text,
	"totalAwardedValue" numeric DEFAULT '0',
	"winCount" integer DEFAULT 0,
	"lossCount" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid,
	"sectionId" uuid,
	"taskId" uuid,
	"authorId" uuid NOT NULL,
	"content" text NOT NULL,
	"parentId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractId" uuid NOT NULL,
	"severity" text DEFAULT 'WARN' NOT NULL,
	"exceptionType" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"assignedToId" uuid,
	"resolutionNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'boilerplate',
	"content" text NOT NULL,
	"serviceLines" jsonb,
	"tags" jsonb,
	"isApproved" boolean DEFAULT false,
	"approvedBy" uuid,
	"version" integer DEFAULT 1,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractId" uuid NOT NULL,
	"amendmentType" text DEFAULT 'amendment',
	"amendmentNumber" text,
	"amendmentDate" timestamp with time zone,
	"amount" numeric DEFAULT '0' NOT NULL,
	"amountBehavior" text DEFAULT 'adds_to_value',
	"amountChange" numeric,
	"description" text,
	"approvalStatus" text DEFAULT 'pending',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractId" uuid,
	"fileName" text,
	"fileUrl" text,
	"fileKey" text,
	"status" text DEFAULT 'pending',
	"extractedParties" jsonb,
	"extractedDates" jsonb,
	"extractedValues" jsonb,
	"extractedClauses" jsonb,
	"riskFlags" jsonb,
	"complianceFlags" jsonb,
	"summary" text,
	"rawAnalysis" text,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid,
	"pursuitId" uuid,
	"projectId" uuid,
	"sourceOpportunityId" uuid,
	"clientId" uuid,
	"clientName" text,
	"title" text NOT NULL,
	"contractNumber" text,
	"projectNumber" text,
	"status" text DEFAULT 'draft',
	"contractVehicle" text DEFAULT 'standalone',
	"companyRole" text DEFAULT 'prime',
	"billingMethods" jsonb,
	"ownerName" text,
	"primeName" text,
	"contractManagerId" uuid,
	"contractManagerName" text,
	"projectManagerName" text,
	"accountingContactName" text,
	"serviceLines" jsonb,
	"primaryLocation" text,
	"isPublic" boolean DEFAULT true,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"executionDate" timestamp with time zone,
	"value" numeric DEFAULT '0',
	"hasNteCeiling" boolean DEFAULT false,
	"nteCeilingAmount" numeric,
	"billingBasis" text DEFAULT 'authorized',
	"totalBilledAmount" numeric DEFAULT '0',
	"retainageAmount" numeric DEFAULT '0',
	"lastInvoicedDate" timestamp with time zone,
	"billingPercentage" numeric DEFAULT '0',
	"isBillingOverCeiling" boolean DEFAULT false,
	"computedContractValue" numeric DEFAULT '0',
	"qbName" text,
	"clientProjectRef" text,
	"timeCode" text,
	"performingCompanyId" uuid,
	"performingCompanyName" text,
	"departmentId" uuid,
	"serviceTypeIds" jsonb,
	"form254CodeId" uuid,
	"projectManagerId" uuid,
	"projectAccountantId" uuid,
	"clientOrgId" uuid,
	"ownerOrgId" uuid,
	"coiRequired" boolean DEFAULT false,
	"coiReceived" boolean DEFAULT false,
	"coiExpirationDate" timestamp with time zone,
	"fullyExecutedContractReceived" boolean DEFAULT false,
	"primeAgreementRequired" boolean DEFAULT false,
	"primeAgreementOnFile" boolean DEFAULT false,
	"clientBillingInfoOnFile" boolean DEFAULT false,
	"coiReceivedDate" timestamp with time zone,
	"fullyExecutedContractDate" timestamp with time zone,
	"primeAgreementDate" timestamp with time zone,
	"hasCOI" boolean DEFAULT false,
	"hasSignedContract" boolean DEFAULT false,
	"structureType" text DEFAULT 'CONTRACT_IS_PROJECT',
	"contractOwnerId" uuid,
	"primeOrgId" uuid,
	"parentContractId" uuid,
	"level" integer DEFAULT 1,
	"tierLabelId" uuid,
	"nodeType" text DEFAULT 'contract',
	"budgetBehavior" text DEFAULT 'draws_from_parent',
	"amountBehavior" text DEFAULT 'independent',
	"documentUrl" text,
	"documentKey" text,
	"milestones" jsonb,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dam_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"docType" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"companyTag" text,
	"staffName" text,
	"staffId" uuid,
	"projectId" uuid,
	"projectName" text,
	"projectNumber" text,
	"pursuitId" uuid,
	"proposalId" uuid,
	"clientName" text,
	"contractValue" text,
	"awardYear" integer,
	"fileName" text NOT NULL,
	"fileKey" text NOT NULL,
	"fileUrl" text NOT NULL,
	"mimeType" text,
	"fileSizeBytes" integer,
	"extractedText" text,
	"extractedMeta" jsonb,
	"processingStatus" text DEFAULT 'uploaded' NOT NULL,
	"processingError" text,
	"tags" text,
	"uploadedBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_shreds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileName" text NOT NULL,
	"fileUrl" text NOT NULL,
	"fileKey" text NOT NULL,
	"mimeType" text,
	"fileSize" integer,
	"xmlContent" text,
	"metadata" text,
	"proposalId" uuid,
	"pursuitId" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shortName" text,
	"badgeColor" text DEFAULT 'blue',
	"supabaseCompanyId" text,
	"isDefault" boolean DEFAULT false,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_254_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"definition" text NOT NULL,
	"characteristics" jsonb,
	"typicalUse" jsonb,
	"oneLiner" text,
	"category" text DEFAULT 'general',
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"type" text DEFAULT 'system',
	"referenceId" uuid,
	"referenceType" text,
	"isRead" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"rfpNumber" text,
	"clientId" uuid,
	"clientName" text,
	"source" text DEFAULT 'manual',
	"sourceUrl" text,
	"description" text,
	"serviceLines" jsonb,
	"estimatedValue" numeric,
	"dueDate" timestamp with time zone,
	"publishedDate" timestamp with time zone,
	"aiScore" numeric,
	"aiScoreReason" text,
	"goNoGoScore" numeric,
	"goNoGoNotes" text,
	"goNoGoDecision" text DEFAULT 'pending',
	"status" text DEFAULT 'new',
	"assignedTo" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunityId" uuid NOT NULL,
	"firmName" text NOT NULL,
	"role" text,
	"isWinner" boolean DEFAULT false,
	"winningFee" numeric,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_debriefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunityId" uuid NOT NULL,
	"outcome" text,
	"winningFirm" text,
	"winningFee" numeric,
	"ourFee" numeric,
	"lowestBidder" text,
	"debriefNotes" text,
	"lessonsLearned" text,
	"debriefDate" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_debriefs_opportunityId_unique" UNIQUE("opportunityId")
);
--> statement-breakpoint
CREATE TABLE "opportunity_team_firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunityId" uuid NOT NULL,
	"firmName" text NOT NULL,
	"role" text,
	"scope" text,
	"estimatedFee" numeric,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"orgType" text DEFAULT 'CLIENT',
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"phone" text,
	"email" text,
	"website" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"role" text DEFAULT 'PM',
	"organizationId" uuid,
	"organizationName" text,
	"email" text,
	"phone" text,
	"title" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"yearsExperience" integer,
	"education" text,
	"licenses" jsonb,
	"certifications" jsonb,
	"serviceLines" jsonb,
	"summary" text,
	"baseResumeUrl" text,
	"baseResumeKey" text,
	"tags" jsonb,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnelId" uuid NOT NULL,
	"projectId" uuid NOT NULL,
	"role" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "amp_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"projectNumber" text,
	"clientId" uuid,
	"clientName" text,
	"serviceLine" text,
	"description" text,
	"location" text,
	"state" text DEFAULT 'NY',
	"contractValue" numeric,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"status" text DEFAULT 'active',
	"highlights" text,
	"tags" jsonb,
	"imageUrl" text,
	"isPublic" boolean DEFAULT true,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pursuitId" uuid,
	"proposalId" uuid,
	"sectionType" text,
	"sectionName" text,
	"proposalText" text,
	"overallScore" integer,
	"overallPassed" boolean DEFAULT false,
	"criteriaScores" text,
	"annotations" text,
	"summary" text,
	"topImprovements" text,
	"rfpContext" text,
	"successCriteria" text,
	"provider" text,
	"model" text,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"sectionOrder" integer DEFAULT 0,
	"rfpRequirement" text,
	"complianceStatus" text DEFAULT 'missing',
	"aiGenerated" boolean DEFAULT false,
	"assignedTo" uuid,
	"status" text DEFAULT 'draft',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pursuitId" uuid,
	"title" text NOT NULL,
	"rfpNumber" text,
	"clientId" uuid,
	"clientName" text,
	"serviceLines" jsonb,
	"status" text DEFAULT 'draft',
	"dueDate" timestamp with time zone,
	"submittedDate" timestamp with time zone,
	"coordinatorId" uuid,
	"rfpFileUrl" text,
	"rfpFileKey" text,
	"requirementsMatrix" jsonb,
	"complianceScore" numeric,
	"sections" jsonb,
	"selectedPersonnelIds" jsonb,
	"selectedProjectIds" jsonb,
	"exportPackageUrl" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pursuits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunityId" uuid,
	"title" text NOT NULL,
	"rfpNumber" text,
	"clientId" uuid,
	"clientName" text,
	"serviceLines" jsonb,
	"status" text DEFAULT 'identify',
	"estimatedValue" numeric,
	"probability" numeric,
	"dueDate" timestamp with time zone,
	"leadId" uuid,
	"coordinatorId" uuid,
	"goNoGoScore" numeric,
	"goNoGoNotes" text,
	"winThemes" text,
	"competitorNotes" text,
	"notes" text,
	"isWon" boolean,
	"awardedValue" numeric,
	"lostReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfp_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shredId" uuid NOT NULL,
	"pursuitId" uuid,
	"conflictType" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"conflictingFacts" text NOT NULL,
	"recommendation" text,
	"status" text DEFAULT 'open',
	"resolvedNote" text,
	"resolvedAt" timestamp with time zone,
	"resolvedBy" uuid,
	"detectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"provider" text,
	"model" text
);
--> statement-breakpoint
CREATE TABLE "rfp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pursuitId" uuid,
	"proposalId" uuid,
	"opportunityId" uuid,
	"rfpFileName" text,
	"rfpFileKey" text,
	"rfpFileUrl" text,
	"rfpMimeType" text,
	"rfpFileSizeBytes" integer,
	"extractedData" jsonb,
	"skillOutputs" jsonb,
	"workflowState" jsonb,
	"sessionStatus" text DEFAULT 'not_started' NOT NULL,
	"liveScore" integer,
	"liveScoreDetails" jsonb,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfp_structured_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shredId" uuid NOT NULL,
	"pursuitId" uuid,
	"submissionDeadlines" text,
	"contractValues" text,
	"evaluationCriteria" text,
	"eligibilityRequirements" text,
	"submissionRequirements" text,
	"keyPersonnel" text,
	"keyDates" text,
	"pageLimits" text,
	"references" text,
	"scopeItems" text,
	"sectionMap" text,
	"extractedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"provider" text,
	"model" text
);
--> statement-breakpoint
CREATE TABLE "rfp_wikis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shredId" uuid NOT NULL,
	"pursuitId" uuid,
	"proposalId" uuid,
	"wikiContent" text,
	"evaluationCriteria" text,
	"keyRequirements" text,
	"keyDates" text,
	"keyPersonnel" text,
	"tokenEstimate" integer,
	"compiledAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tailored_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid NOT NULL,
	"personnelId" uuid NOT NULL,
	"rfpRole" text,
	"tailoredContent" text,
	"fileUrl" text,
	"fileKey" text,
	"aiGenerated" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amp_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid,
	"pursuitId" uuid,
	"title" text NOT NULL,
	"description" text,
	"assignedTo" uuid,
	"assignedBy" uuid,
	"status" text DEFAULT 'open',
	"priority" text DEFAULT 'medium',
	"dueDate" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amp_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"openId" text NOT NULL,
	"name" text,
	"email" text,
	"loginMethod" text,
	"role" text DEFAULT 'read_only' NOT NULL,
	"title" text,
	"department" text,
	"phone" text,
	"avatarUrl" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amp_users_openId_unique" UNIQUE("openId")
);
