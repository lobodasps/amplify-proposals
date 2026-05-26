CREATE TABLE `ai_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillType` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`description` text,
	`provider` varchar(64) NOT NULL DEFAULT 'manus_builtin',
	`model` varchar(128),
	`apiKey` text,
	`baseUrl` varchar(512),
	`systemPrompt` text NOT NULL,
	`userPromptTemplate` text NOT NULL,
	`templateVariables` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_skills_skillType_unique` UNIQUE(`skillType`)
);
