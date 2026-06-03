ALTER TABLE "cards" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" DROP COLUMN "language";