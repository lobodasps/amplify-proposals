CREATE TABLE `proposal_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pursuitId` int,
	`proposalId` int,
	`sectionType` varchar(128),
	`sectionName` varchar(256),
	`proposalText` text,
	`overallScore` int,
	`overallPassed` boolean DEFAULT false,
	`criteriaScores` text,
	`annotations` text,
	`summary` text,
	`topImprovements` text,
	`rfpContext` text,
	`successCriteria` text,
	`provider` varchar(64),
	`model` varchar(128),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposal_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rfp_wikis` ADD `pursuitId` int;