CREATE TABLE `checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`checked_by` integer,
	`checked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `downtime_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`opened_by` integer,
	`closed_by` integer,
	`work_order_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `downtime_open_idx` ON `downtime_periods` (`machine_id`,`ended_at`);--> statement-breakpoint
CREATE TABLE `machines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`notes` text,
	`photo_path` text,
	`retired_at` integer,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machines_code_unique` ON `machines` (`code`);--> statement-breakpoint
CREATE INDEX `machines_code_idx` ON `machines` (`code`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`bin_location` text,
	`photo_path` text,
	`min_level` integer DEFAULT 0 NOT NULL,
	`unit_cost` real,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_sku_unique` ON `parts` (`sku`);--> statement-breakpoint
CREATE INDEX `parts_sku_idx` ON `parts` (`sku`);--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`path` text NOT NULL,
	`uploaded_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photos_entity_idx` ON `photos` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `pm_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`title` text NOT NULL,
	`interval_days` integer NOT NULL,
	`next_due_date` integer NOT NULL,
	`default_assignee_id` integer,
	`checklist_template` text,
	`paused` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`description` text NOT NULL,
	`reporter_name` text,
	`photo_path` text,
	`status` text DEFAULT 'new' NOT NULL,
	`work_order_id` integer,
	`dismiss_reason` text,
	`handled_by` integer,
	`handled_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_name` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reason` text,
	`note` text,
	`work_order_id` integer,
	`reverses_movement_id` integer,
	`actor_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movements_part_idx` ON `stock_movements` (`part_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'technician' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_order_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`part_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`movement_id` integer NOT NULL,
	`reversed` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movement_id`) REFERENCES `stock_movements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text,
	`actor_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`machine_id` integer NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_id` integer,
	`due_date` integer,
	`description` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`pm_schedule_id` integer,
	`report_id` integer,
	`cancel_reason` text,
	`completion_note` text,
	`time_spent_minutes` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pm_schedule_id`) REFERENCES `pm_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wo_status_idx` ON `work_orders` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `wo_assignee_idx` ON `work_orders` (`assignee_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `wo_pm_due_unq` ON `work_orders` (`pm_schedule_id`,`due_date`) WHERE "work_orders"."pm_schedule_id" is not null;