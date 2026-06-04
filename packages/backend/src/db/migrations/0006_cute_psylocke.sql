CREATE TABLE "card_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"reason" text NOT NULL,
	"message" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_reports" ADD CONSTRAINT "card_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_reports" ADD CONSTRAINT "card_reports_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_reports" ADD CONSTRAINT "card_reports_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_reports_user_card_unique" ON "card_reports" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "card_reports_user_subject_idx" ON "card_reports" USING btree ("user_id","subject_id");