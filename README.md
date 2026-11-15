# Rows

Portfolio builder: GitHub sync, experiences, AI About, public profile at `/in/@handle`.

Production: [rows.so](https://rows.so)

Product: [`docs/product-plan.md`](./docs/product-plan.md) is the single product document (what Rows is, who it is for, roadmap). The MVP tasks that implement it are tracked in the Linear project "Rows MVP".

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Postgres + Drizzle ORM
- Email-only login with a one-time link (no passwords, no Auth.js); email sent through Resend

## Quick start

1. `cp .env.example .env.local` and fill values (see [`docs/phase-0-setup.md`](./docs/phase-0-setup.md)).
2. `npm run db:migrate` (applies the migrations in `drizzle/` that are not applied yet)
3. `npm run dev`

### Required env

- `DATABASE_URL`
- `AUTH_SECRET` (session cookie signing key)
- `RESEND_API_KEY` / `EMAIL_FROM` (login link emails)
- `NEXT_PUBLIC_SITE_URL=https://rows.so` (landing, pricing, public profiles)
- `NEXT_PUBLIC_APP_URL=https://app.rows.so` (sign-in, onboarding, dashboard)

- Landing: `https://rows.so`
- Sign in: `https://app.rows.so/sign-in`
- Login link lands on: `https://app.rows.so/sign-in/verify`
- App pages asked for on `rows.so` redirect to `app.rows.so`, and the other way round (`src/proxy.ts`)

- `ANTHROPIC_KEYS` (optional): turns on AI project cards, the summary draft, resume import and the CV assistant.

## Phase 1: what's built

Product plan: [`docs/product-plan.md`](./docs/product-plan.md).

| Route | What it is |
| --- | --- |
| `/dashboard` | Onboarding checklist, your link, publish/unpublish, LinkedIn Featured instructions |
| `/dashboard/projects` | Sync public GitHub repos, pin up to 6, AI-drafted cards you approve |
| `/dashboard/experience` | Import a resume / LinkedIn PDF or CSV, edit entries, link projects to jobs |
| `/dashboard/profile` | The 60-second header, goals, open-to-work details, contact |
| `/dashboard/assistant` | AI CV interview; "Save to my CV" writes the entries |
| `/sign-in`, `/sign-in/verify` | Email-only login: one field, a one-time link valid for 15 minutes, confirmed with a button |
| `/onboarding` | First access: choose the unique handle |
| `/in/@handle` | Public, recruiter-first profile. Unpublished or unknown handles return 404; the owner sees a preview |
| `/in/@handle/opengraph-image` | The card LinkedIn shows for the link |
| `/in/@handle/resume` | ATS-ready resume PDF |

Database: `drizzle/0002_phase_1.sql` adds `profiles`, `projects`, `experiences`, `experience_projects` and `assistant_threads`. It only creates tables (RLS on, no access through the Supabase REST API). Apply it with `npm run db:migrate`.

## Database migrations

The files in `drizzle/` are the only way the schema changes. Never run `drizzle-kit push`: there is no `db:push` script on purpose.

| Command | What it does |
| --- | --- |
| `npm run db:generate` | After editing `src/db/schema.ts`: writes the next migration and snapshot. Review the SQL and commit both. |
| `npm run db:migrate` | Applies the migrations that are not applied yet to the database in `DATABASE_URL`. |
| `npm run db:check` | Checks that the migration files and snapshots agree with each other. |
| `npm run db:baseline` | Prints SQL that marks the existing migrations as applied (see below). It never connects to a database. |

CI fails a PR when `src/db/schema.ts` changed and `npm run db:generate` would write a new migration, so a schema change always ships with its migration.

### One-time baseline for a database migrated by hand

Production was migrated through Supabase, so it has no `drizzle.__drizzle_migrations` table. Running `db:migrate` there would try to create the tables again. Before the first `db:migrate` on such a database:

1. Take a backup (`pg_dump`, or a Supabase backup).
2. Run `npm run db:baseline`, read the SQL and run it on that database.
3. Run `npm run db:migrate`. It should apply nothing.

The baseline lists every migration in `drizzle/meta/_journal.json`. Run it before adding a new migration, or the new one will be marked as applied without running.
