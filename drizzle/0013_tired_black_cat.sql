ALTER TABLE `contracts` ADD `clientProjectRef` varchar(256);--> statement-breakpoint
ALTER TABLE `contracts` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `serviceTypeIds` json;--> statement-breakpoint
ALTER TABLE `contracts` ADD `form254CodeId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `projectManagerId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `projectAccountantId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `clientOrgId` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `ownerOrgId` int;