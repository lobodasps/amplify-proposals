ALTER TABLE `contracts` ADD `coiReceivedDate` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `fullyExecutedContractDate` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `primeAgreementDate` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `hasCOI` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `hasSignedContract` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `contracts` ADD `structureType` varchar(64) DEFAULT 'CONTRACT_IS_PROJECT';--> statement-breakpoint
ALTER TABLE `contracts` ADD `contractOwnerId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `primeOrgId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `tierLabelId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `amountBehavior` varchar(32) DEFAULT 'independent';