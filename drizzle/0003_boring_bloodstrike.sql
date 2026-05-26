CREATE TABLE `contract_amendments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`amendmentType` varchar(64) DEFAULT 'amendment',
	`amendmentNumber` varchar(64),
	`amendmentDate` timestamp,
	`amount` float NOT NULL DEFAULT 0,
	`description` text,
	`approvalStatus` varchar(32) DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contract_amendments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `contract_status` enum('draft','negotiation','executed','active','on_hold','completed','terminated') DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `value` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` ADD `sourceOpportunityId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `projectNumber` varchar(128);--> statement-breakpoint
ALTER TABLE `contracts` ADD `contractVehicle` varchar(64) DEFAULT 'standalone';--> statement-breakpoint
ALTER TABLE `contracts` ADD `companyRole` varchar(32) DEFAULT 'prime';--> statement-breakpoint
ALTER TABLE `contracts` ADD `billingMethods` json;--> statement-breakpoint
ALTER TABLE `contracts` ADD `ownerName` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `primeName` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `projectManagerName` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `accountingContactName` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `primaryLocation` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `isPublic` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `contracts` ADD `hasNteCeiling` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `nteCeilingAmount` float;--> statement-breakpoint
ALTER TABLE `contracts` ADD `billingBasis` varchar(32) DEFAULT 'authorized';--> statement-breakpoint
ALTER TABLE `contracts` ADD `totalBilledAmount` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` ADD `retainageAmount` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` ADD `lastInvoicedDate` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `billingPercentage` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` ADD `isBillingOverCeiling` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `computedContractValue` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` ADD `qbName` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `timeCode` varchar(128);--> statement-breakpoint
ALTER TABLE `contracts` ADD `coiRequired` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `coiReceived` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `coiExpirationDate` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `fullyExecutedContractReceived` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `primeAgreementRequired` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `primeAgreementOnFile` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `clientBillingInfoOnFile` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `parentContractId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `level` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `contracts` ADD `nodeType` varchar(32) DEFAULT 'contract';--> statement-breakpoint
ALTER TABLE `contracts` ADD `budgetBehavior` varchar(32) DEFAULT 'draws_from_parent';