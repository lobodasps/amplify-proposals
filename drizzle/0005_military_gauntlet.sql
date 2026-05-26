CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`description` text,
	`changedFields` json,
	`userId` int,
	`userName` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`description` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `billing_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`invoiceNumber` varchar(128),
	`invoiceDate` timestamp,
	`amount` float NOT NULL DEFAULT 0,
	`billedAmount` float DEFAULT 0,
	`retainageAmount` float DEFAULT 0,
	`description` text,
	`source` varchar(32) DEFAULT 'manual',
	`qbInvoiceId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_exceptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'WARN',
	`exceptionType` varchar(64) NOT NULL,
	`description` text,
	`status` varchar(16) NOT NULL DEFAULT 'OPEN',
	`assignedToId` int,
	`resolutionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `compliance_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int,
	`fileName` varchar(512),
	`fileUrl` text,
	`fileKey` text,
	`status` varchar(32) DEFAULT 'pending',
	`extractedParties` json,
	`extractedDates` json,
	`extractedValues` json,
	`extractedClauses` json,
	`riskFlags` json,
	`complianceFlags` json,
	`summary` text,
	`rawAnalysis` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contract_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`shortName` varchar(64),
	`badgeColor` varchar(32) DEFAULT 'blue',
	`supabaseCompanyId` varchar(64),
	`isDefault` boolean DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_254_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_254_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `glossary_terms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(256) NOT NULL,
	`definition` text NOT NULL,
	`characteristics` json,
	`typicalUse` json,
	`oneLiner` text,
	`category` varchar(32) DEFAULT 'general',
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `glossary_terms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunity_competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`firmName` varchar(256) NOT NULL,
	`role` varchar(64),
	`isWinner` boolean DEFAULT false,
	`winningFee` float,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunity_competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunity_debriefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`outcome` varchar(32),
	`winningFirm` varchar(256),
	`winningFee` float,
	`ourFee` float,
	`lowestBidder` varchar(256),
	`debriefNotes` text,
	`lessonsLearned` text,
	`debriefDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunity_debriefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunity_debriefs_opportunityId_unique` UNIQUE(`opportunityId`)
);
--> statement-breakpoint
CREATE TABLE `opportunity_team_firms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`firmName` varchar(256) NOT NULL,
	`role` varchar(128),
	`scope` text,
	`estimatedFee` float,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunity_team_firms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`orgType` varchar(32) DEFAULT 'CLIENT',
	`address` text,
	`city` varchar(128),
	`state` varchar(32),
	`zip` varchar(16),
	`phone` varchar(32),
	`email` varchar(320),
	`website` text,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`role` varchar(64) DEFAULT 'PM',
	`organizationId` int,
	`organizationName` varchar(256),
	`email` varchar(320),
	`phone` varchar(32),
	`title` varchar(128),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `people_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(32),
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_types_id` PRIMARY KEY(`id`)
);
