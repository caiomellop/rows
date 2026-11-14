# Rows

Portfolio builder: GitHub sync, experiences, AI About, public profile at `/u/[username]`.

Production: [rows.so](https://rows.so)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Postgres + Drizzle ORM
- Auth.js (NextAuth v5) with GitHub

## Quick start

1. `cp .env.example .env.local` and fill values (see [`docs/phase-0-setup.md`](./docs/phase-0-setup.md)).
2. `npm run db:push`
3. `npm run dev`

### Required env

- `DATABASE_URL` — Supabase Postgres URI (transaction pooler preferred; already on Vercel)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth App
- `NEXT_PUBLIC_APP_URL` — `https://rows.so` (prod) or `http://localhost:3000` (local)

GitHub OAuth **callback URL:** `https://rows.so/api/auth/callback/github`  
(local: `http://localhost:3000/api/auth/callback/github`)

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to Postgres |
| `npm run db:studio` | Drizzle Studio |

## Phase 0 done criteria

GitHub login works and creates a user in the `users` table.
