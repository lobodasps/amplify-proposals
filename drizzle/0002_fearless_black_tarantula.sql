ALTER TABLE `assets` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `assets` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `content_library` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `content_library` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `milestones` json;--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `personnel` MODIFY COLUMN `licenses` json;--> statement-breakpoint
ALTER TABLE `personnel` MODIFY COLUMN `certifications` json;--> statement-breakpoint
ALTER TABLE `personnel` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `personnel` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `serviceLines` json;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `requirementsMatrix` json;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `sections` json;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `selectedPersonnelIds` json;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `selectedProjectIds` json;--> statement-breakpoint
ALTER TABLE `pursuits` MODIFY COLUMN `serviceLines` json;