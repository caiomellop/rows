-- Supabase exposes every table in `public` through its REST API (PostgREST)
-- to the `anon` and `authenticated` roles. With RLS off, anyone holding the
-- project's anon key could read or modify users and GitHub access tokens.
-- The app connects as `postgres` (bypasses RLS), so it is unaffected.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "accounts", "users" FROM anon, authenticated;--> statement-breakpoint
-- Leftover Auth.js tables, never used by this app (custom OAuth + JWT cookie).
DROP TABLE IF EXISTS "sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "verification_tokens" CASCADE;
