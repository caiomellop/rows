CREATE TABLE "login_tokens" (
	"tokenHash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ipHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "login_tokens_created" ON "login_tokens" USING btree ("createdAt");--> statement-breakpoint
-- Same lockdown as 0001: no access through Supabase's public REST API.
REVOKE ALL ON TABLE "login_tokens" FROM anon, authenticated;--> statement-breakpoint
-- Accounts are now keyed by email (trimmed, lowercase). Normalize what the
-- GitHub login stored, skipping a row if that would collide with another one.
UPDATE "users" u SET "email" = lower(btrim(u."email"))
WHERE u."email" <> lower(btrim(u."email"))
  AND NOT EXISTS (SELECT 1 FROM "users" o WHERE o."id" <> u."id" AND o."email" = lower(btrim(u."email")));
