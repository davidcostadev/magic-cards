CREATE INDEX `card_progress_user_next_idx` ON `card_progress` (`user_id`,`next_review_date`);--> statement-breakpoint
CREATE INDEX `cards_subject_idx` ON `cards` (`subject_id`);--> statement-breakpoint
CREATE INDEX `review_history_user_reviewed_idx` ON `review_history` (`user_id`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `subjects_user_idx` ON `subjects` (`user_id`);