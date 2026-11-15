# Rows

AI copilot for job candidates (being renamed to Prepermint, tracked in MVP-50).

What to build, in what order and with which acceptance criteria lives in Linear: project **Prepermint MVP**, team **CAI**. The rules for working in this repo are in [`AGENTS.md`](./AGENTS.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Postgres + Drizzle ORM
- Email-only login with a one-time link (no passwords, no Auth.js); email sent through Resend
- Anthropic Claude for the AI features

## Quick start

1. `cp .env.example .env.local` and fill in the values. Each variable is explained in `.env.example`.
2. `npm install`
3. `npm run db:migrate` (applies the migrations in `drizzle/` that are not applied yet)
4. `npm run dev`

Required variables: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL`. `ANTHROPIC_KEYS` is optional: without it the AI buttons are hidden.

## Hosts

- Site: `https://rows.so` (landing, pricing, terms, privacy)
- App: `https://app.rows.so` (sign-in, chat, memory, dashboard)
- The login link lands on `https://app.rows.so/sign-in/verify`.
- A path asked for on the wrong host is redirected to the right one (`src/proxy.ts`).

## Checks

```
npm run lint
npm test
npx next build
```

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
