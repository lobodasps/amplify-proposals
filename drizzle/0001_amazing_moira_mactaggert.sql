CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`description` text,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(128),
	`fileSize` int,
	`asset_type` enum('image','document','presentation','spreadsheet','video','other') DEFAULT 'document',
	`folder` varchar(256) DEFAULT 'root',
	`tags` json,
	`serviceLines` json,
	`projectId` int,
	`version` int DEFAULT 1,
	`parentAssetId` int,
	`uploadedBy` int,
	`isPublic` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`type` enum('public_agency','private','municipal','state','federal','other') DEFAULT 'public_agency',
	`state` enum('NJ','NY','CT','PA','other') DEFAULT 'NY',
	`city` varchar(128),
	`contactName` varchar(256),
	`contactEmail` varchar(320),
	`contactPhone` varchar(32),
	`notes` text,
	`totalAwardedValue` float DEFAULT 0,
	`winCount` int DEFAULT 0,
	`lossCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int,
	`sectionId` int,
	`taskId` int,
	`authorId` int NOT NULL,
	`content` text NOT NULL,
	`parentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`category` enum('boilerplate','qualifications','approach','methodology','cover_letter','executive_summary','project_narrative','certifications','other') DEFAULT 'boilerplate',
	`content` text NOT NULL,
	`serviceLines` json,
	`tags` json,
	`isApproved` boolean DEFAULT false,
	`approvedBy` int,
	`version` int DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int,
	`pursuitId` int,
	`projectId` int,
	`clientId` int,
	`clientName` varchar(256),
	`title` varchar(512) NOT NULL,
	`contractNumber` varchar(128),
	`contract_status` enum('draft','negotiation','executed','active','completed','terminated') DEFAULT 'draft',
	`value` float,
	`startDate` timestamp,
	`endDate` timestamp,
	`executionDate` timestamp,
	`serviceLines` json,
	`contractManagerId` int,
	`documentUrl` text,
	`documentKey` text,
	`milestones` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`message` text,
	`notif_type` enum('task','proposal','pursuit','contract','opportunity','system') DEFAULT 'system',
	`referenceId` int,
	`referenceType` varchar(64),
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`rfpNumber` varchar(128),
	`clientId` int,
	`clientName` varchar(256),
	`opportunity_source` enum('njdot','nysdot','nyc_dddc','nyc_dot','nyc_dep','njta','panynj','manual','other') DEFAULT 'manual',
	`sourceUrl` text,
	`description` text,
	`serviceLines` json,
	`estimatedValue` float,
	`dueDate` timestamp,
	`publishedDate` timestamp,
	`aiScore` float,
	`aiScoreReason` text,
	`goNoGoScore` float,
	`goNoGoNotes` text,
	`go_no_go_decision` enum('go','no_go','pending') DEFAULT 'pending',
	`opp_status` enum('new','reviewing','pursuing','submitted','awarded','lost','archived') DEFAULT 'new',
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personnel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(256) NOT NULL,
	`title` varchar(128),
	`email` varchar(320),
	`phone` varchar(32),
	`yearsExperience` int,
	`education` text,
	`licenses` json,
	`certifications` json,
	`serviceLines` json,
	`summary` text,
	`baseResumeUrl` text,
	`baseResumeKey` text,
	`tags` json,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personnel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personnel_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`personnelId` int NOT NULL,
	`projectId` int NOT NULL,
	`role` varchar(128),
	`description` text,
	CONSTRAINT `personnel_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`projectNumber` varchar(64),
	`clientId` int,
	`clientName` varchar(256),
	`service_line` enum('special_inspections','construction_management','traffic_engineering','landscape_streetscape','environmental','other'),
	`description` text,
	`location` varchar(256),
	`state` enum('NJ','NY','CT','PA','other') DEFAULT 'NY',
	`contractValue` float,
	`startDate` timestamp,
	`endDate` timestamp,
	`status` enum('active','completed','on_hold','cancelled') DEFAULT 'active',
	`highlights` text,
	`tags` json,
	`imageUrl` text,
	`isPublic` boolean DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposal_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text,
	`sectionOrder` int DEFAULT 0,
	`rfpRequirement` text,
	`compliance_status` enum('compliant','partial','missing','na') DEFAULT 'missing',
	`aiGenerated` boolean DEFAULT false,
	`assignedTo` int,
	`section_status` enum('draft','in_review','approved') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposal_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pursuitId` int,
	`title` varchar(512) NOT NULL,
	`rfpNumber` varchar(128),
	`clientId` int,
	`clientName` varchar(256),
	`serviceLines` json,
	`proposal_status` enum('draft','in_review','approved','submitted','awarded','lost','archived') DEFAULT 'draft',
	`dueDate` timestamp,
	`submittedDate` timestamp,
	`coordinatorId` int,
	`rfpFileUrl` text,
	`rfpFileKey` text,
	`requirementsMatrix` json,
	`complianceScore` float,
	`sections` json,
	`selectedPersonnelIds` json,
	`selectedProjectIds` json,
	`exportPackageUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pursuits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int,
	`title` varchar(512) NOT NULL,
	`rfpNumber` varchar(128),
	`clientId` int,
	`clientName` varchar(256),
	`serviceLines` json,
	`pursuit_status` enum('identify','qualify','pursue','submit','award','lost','no_go') DEFAULT 'identify',
	`estimatedValue` float,
	`probability` float,
	`dueDate` timestamp,
	`leadId` int,
	`coordinatorId` int,
	`goNoGoScore` float,
	`goNoGoNotes` text,
	`winThemes` text,
	`competitorNotes` text,
	`notes` text,
	`isWon` boolean,
	`awardedValue` float,
	`lostReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pursuits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tailored_resumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`personnelId` int NOT NULL,
	`rfpRole` varchar(256),
	`tailoredContent` text,
	`fileUrl` text,
	`fileKey` text,
	`aiGenerated` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tailored_resumes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int,
	`pursuitId` int,
	`title` varchar(512) NOT NULL,
	`description` text,
	`assignedTo` int,
	`assignedBy` int,
	`task_status` enum('open','in_progress','review','done','overdue') DEFAULT 'open',
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('administrator','executive','business_development','proposal_coordinator','project_manager','technical_reviewer','designer','contract_manager','read_only','admin','user') NOT NULL DEFAULT 'read_only';--> statement-breakpoint
ALTER TABLE `users` ADD `title` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;