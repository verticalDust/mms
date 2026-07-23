CREATE TABLE `machine_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`part_id` integer NOT NULL,
	`quantity` integer,
	`note` text,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machine_parts_unq` ON `machine_parts` (`machine_id`,`part_id`);--> statement-breakpoint
CREATE INDEX `machine_parts_machine_idx` ON `machine_parts` (`machine_id`);--> statement-breakpoint
CREATE INDEX `machine_parts_part_idx` ON `machine_parts` (`part_id`);