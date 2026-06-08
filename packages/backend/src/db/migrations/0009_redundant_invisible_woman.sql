ALTER TABLE "card_reports" ADD COLUMN "suggestion" text;--> statement-breakpoint
ALTER TABLE "card_reports" ADD COLUMN "resolved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "card_reports" ADD COLUMN "resolved_at" text;