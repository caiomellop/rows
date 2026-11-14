# Phase 1: personal portfolio

The core product: every user gets an editable portfolio and a public page at `/u/[username]`.

## Routes

| Path | What |
| --- | --- |
| `/dashboard` | Editor: profile, projects (GitHub sync, pin, reorder, hide, manual), experiences, publish toggle |
| `/dashboard/preview` | The portfolio exactly as visitors see it, published or not |
| `/u/[username]` | Public portfolio. 404 until published. Cached per user, invalidated on every edit |

Sign-in now lands on `/dashboard`.

## Data (`src/db/schema.ts`, migration `drizzle/0001_portfolio.sql`)

- `users` gains profile fields: `username` (unique), `github_login`, `headline`, `about`, `location`, `website`, `published`, `last_synced_at`, timestamps.
- `projects`: synced GitHub repos (`source = 'github'`, keyed by `github_repo_id`) or hand-added (`source = 'manual'`). `visible`, `pinned`, `position` belong to the user and are never overwritten by a sync.
- `experiences` + `experience_projects` (link roles to the projects built there).

Apply with `npm run db:push`, or run `drizzle/0001_portfolio.sql`. It only adds tables and columns.
Existing users get a username (their GitHub login) on their next sign-in.

## GitHub sync (`src/lib/github-sync.ts`)

- Runs automatically on first sign-in and from the dashboard's **Sync GitHub** button.
- Reads public repos the user owns (up to 300, most recently pushed first) with the existing OAuth token; no extra scope needed.
- New forks and archived repos start hidden. Repos deleted or made private on GitHub are removed.
- A 401 means the token was revoked: the dashboard offers **Reconnect** (sign in again).
- `GITHUB_API_URL` overrides the API base (local testing against a mock).

## Caching

`getPublicPortfolio(username)` is `"use cache"` with `cacheTag("profile:<username>")`. Every server action calls `updateTag` for the current (and, on rename, previous) username, so the public page updates immediately. The dashboard and preview read the session, so they are uncached and stream behind `<Suspense>`.

## Fixed along the way

The nav's **Sign out** was a `<Link>` to `GET /auth/logout`. Next.js prefetches links in production, so signed-in users were logged out as soon as the nav rendered. It is now a POST form.

## Not in this phase

- AI-drafted About (Pro plan).
- Profile themes, custom domains, analytics.
- Drag-and-drop ordering (pinned projects use up/down buttons).
