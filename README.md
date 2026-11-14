# Rows

Portfolio builder: GitHub sync, experiences, AI About, public profile at `/u/[username]`.

Production: [rows.so](https://rows.so)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Postgres + Drizzle ORM
- GitHub OAuth (custom, callback `https://rows.so/auth`)

## Quick start

1. `cp .env.example .env.local` and fill values (see [`docs/phase-0-setup.md`](./docs/phase-0-setup.md)).
2. `npm run db:push` (if schema not applied yet)
3. `npm run dev`

### Required env

- `DATABASE_URL`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
- `NEXT_PUBLIC_APP_URL=https://rows.so`

- Landing: `https://rows.so`
- Sign in: `https://rows.so/auth/signin`
- GitHub OAuth callback: `https://rows.so/auth`

## Phase 0 done criteria

GitHub login works and creates a user in the `users` table.
