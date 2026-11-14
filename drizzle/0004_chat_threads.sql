-- A user can now have many conversations (the sidebar lists them), so the
-- thread gets its own id instead of being keyed by the user.
ALTER TABLE "assistant_threads" DROP CONSTRAINT "assistant_threads_pkey";--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "id" text;--> statement-breakpoint
UPDATE "assistant_threads" SET "id" = gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "title" text DEFAULT 'New chat' NOT NULL;--> statement-breakpoint
-- The one conversation that existed before was the CV interview.
UPDATE "assistant_threads" SET "title" = 'CV interview';--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "assistant_threads" SET "createdAt" = "updatedAt";--> statement-breakpoint
CREATE INDEX "assistant_threads_user_updated" ON "assistant_threads" USING btree ("userId","updatedAt");
