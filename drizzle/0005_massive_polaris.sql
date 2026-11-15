DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "experience_projects" CASCADE;--> statement-breakpoint
DROP TABLE "projects" CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_username_unique";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "githubLogin";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "openToWork";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "contactEmail";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "links";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "published";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "reposSyncedAt";