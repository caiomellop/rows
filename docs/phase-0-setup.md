# Phase 0 setup (Caio)

Scaffold: Next.js App Router + TypeScript + Tailwind, Supabase Postgres via Drizzle, Auth.js (v5) with GitHub. Done when GitHub login creates a row in `users`.

## 1. Env file

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI). Prefer **Transaction** pooler (port **6543**). |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; production origin when deployed |

Optional: set `AUTH_URL` to the same value as `NEXT_PUBLIC_APP_URL` if Auth.js mis-detects the host.

## 2. Supabase Postgres

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the Postgres URI into `DATABASE_URL`.
3. From the repo root (with `.env.local` loaded, or `DATABASE_URL` exported):

```bash
npm run db:push
```

That creates Auth.js tables: `users`, `accounts`, `sessions`, `verification_tokens`.

## 3. GitHub OAuth App

1. GitHub → Settings → Developer settings → [OAuth Apps](https://github.com/settings/developers) → New OAuth App.
2. **Homepage URL:** `http://localhost:3000` (or your deployed URL).
3. **Authorization callback URL:**  
   `http://localhost:3000/api/auth/callback/github`  
   (production: `{NEXT_PUBLIC_APP_URL}/api/auth/callback/github`)
4. Copy Client ID → `AUTH_GITHUB_ID`, generate a Client Secret → `AUTH_GITHUB_SECRET`.

## 4. Run

```bash
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Sign in with GitHub**.

## 5. Verify user in DB

After a successful login, in Supabase SQL Editor:

```sql
select id, name, email, image, "emailVerified" from users order by id desc limit 5;
select "userId", provider, "providerAccountId" from accounts;
```

You should see your GitHub profile in `users` and a `github` row in `accounts`.

## How to test login (checklist)

1. Env vars set; `npm run db:push` succeeded.
2. OAuth callback URL matches `{app}/api/auth/callback/github`.
3. `npm run dev` → home shows **Sign in with GitHub**.
4. Complete GitHub consent → home shows name/email/avatar and **Sign out**.
5. Supabase shows a new `users` (and `accounts`) row.

## Phase 1 note

Only Auth.js identity tables are in schema today. Phase 1 will extend `users` and add product tables (`connected_accounts`, `projects`, `experiences`, `experience_projects`) plus `/dashboard`.
