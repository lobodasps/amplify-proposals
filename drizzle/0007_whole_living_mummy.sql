CREATE TABLE `agent_guidelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillType` varchar(64) NOT NULL,
	`proposalId` int,
	`pursuitId` int,
	`sectionName` varchar(256),
	`successCriteria` text,
	`approaches` text,
	`chosenApproachIndex` int,
	`choiceRationale` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_guidelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_shreds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`fileSize` int,
	`xmlContent` text,
	`metadata` text,
	`proposalId` int,
	`pursuitId` int,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_shreds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfp_wikis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shredId` int NOT NULL,
	`proposalId` int,
	`wikiContent` text,
	`evaluationCriteria` text,
	`keyRequirements` text,
	`keyDates` text,
	`keyPersonnel` text,
	`tokenEstimate` int,
	`compiledAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `rfp_wikis_id` PRIMARY KEY(`id`)
);
