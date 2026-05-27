CREATE TABLE `asset_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`color` varchar(32) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_tags_name_unique` UNIQUE(`name`)
);
