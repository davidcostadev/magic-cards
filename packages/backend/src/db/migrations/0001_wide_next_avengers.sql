ALTER TABLE "subjects" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "subjects_public_idx" ON "subjects" USING btree ("is_public");