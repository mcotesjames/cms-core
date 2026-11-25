CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
	`anchor` text NOT NULL,
	`opened_on` text NOT NULL,
	`device` text DEFAULT 'desktop' NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`assignee_id` text,
	`position` text,
	`resolved_at` text,
	`resolved_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_thread` ON `comments` (`thread_id`);--> statement-breakpoint
CREATE INDEX `comments_opened_on` ON `comments` (`opened_on`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`standfirst` text DEFAULT '' NOT NULL,
	`cover` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`published_at` text,
	`published` integer DEFAULT false NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`legacy_body` text DEFAULT '' NOT NULL,
	`seo` text,
	`draft` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_type_slug` ON `entries` (`type`,`slug`);--> statement-breakpoint
CREATE INDEX `entries_type_published` ON `entries` (`type`,`published`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`data` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `list_items_list_position` ON `list_items` (`list`,`position`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	`alt` text DEFAULT '' NOT NULL,
	`previous_key` text,
	`uploaded_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`draft` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_type_position` ON `records` (`type`,`position`);--> statement-breakpoint
CREATE TABLE `site_content` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`draft` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`approved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);