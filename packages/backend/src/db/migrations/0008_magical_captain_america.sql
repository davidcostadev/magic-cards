CREATE TABLE "user_subjects" (
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "user_subjects_user_id_subject_id_pk" PRIMARY KEY("user_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "user_subjects" ADD CONSTRAINT "user_subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subjects" ADD CONSTRAINT "user_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: pre-existing users keep seeing every subject currently visible to them (their own +
-- the public catalog), so adding the selection filter doesn't suddenly empty anyone's grid. The
-- system user (catalog owner) is excluded; ON CONFLICT covers a user owning a subject that's also public.
INSERT INTO "user_subjects" ("user_id", "subject_id", "created_at")
SELECT u."id", s."id", '2026-06-05T00:00:00.000Z'
FROM "users" u
JOIN "subjects" s ON (s."user_id" = u."id" OR s."is_public" = true)
WHERE u."id" <> '00000000-0000-0000-0000-000000000000'
ON CONFLICT DO NOTHING;