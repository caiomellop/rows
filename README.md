# Rows

Portfolio builder: GitHub sync, experiences, AI About, public profile at `/u/[username]`.

Production: [rows.so](https://rows.so)

Product: [`docs/product-plan.md`](./docs/product-plan.md) is the single product document (what Rows is, who it is for, roadmap). The MVP tasks that implement it are tracked in the Linear project "Rows MVP".

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Postgres + Drizzle ORM
- Custom GitHub OAuth (no Auth.js); callback `https://rows.so/auth`

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

## Sign-up flow

1. `/auth` — GitHub OAuth. Creates `users`, `accounts` and a `profiles` row (with the GitHub login).
2. `/onboarding` — pick the public handle (`rows.so/u/{handle}`). Pre-filled with the normalized GitHub login; taken or reserved handles get an alternative. Rules live in `src/lib/username.ts`; uniqueness is enforced by the `profiles_username_unique` index.
3. `/discovery` — first discovery question (the chat itself is MVP-09).

Users without a handle are sent to `/onboarding` after sign-in.

## Phase 0 done criteria

GitHub login works and creates a user in the `users` table.
