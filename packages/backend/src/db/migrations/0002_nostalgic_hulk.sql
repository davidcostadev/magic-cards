ALTER TABLE "cards" ADD COLUMN "type" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "payload" jsonb;