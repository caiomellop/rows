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

- `ANTHROPIC_API_KEY` (optional): turns on AI project cards, the summary draft, resume import and the CV assistant.

## Phase 1: what's built

Product plan: [`docs/product-plan.md`](./docs/product-plan.md).

| Route | What it is |
| --- | --- |
| `/dashboard` | Onboarding checklist, your link, publish/unpublish, LinkedIn Featured instructions |
| `/dashboard/projects` | Sync public GitHub repos, pin up to 6, AI-drafted cards you approve |
| `/dashboard/experience` | Import a resume / LinkedIn PDF or CSV, edit entries, link projects to jobs |
| `/dashboard/profile` | The 60-second header, goals, open-to-work details, contact |
| `/dashboard/assistant` | AI CV interview; "Save to my CV" writes the entries |
| `/u/[username]` | Public, recruiter-first profile (owner sees a preview while unpublished) |
| `/u/[username]/opengraph-image` | The card LinkedIn shows for the link |
| `/u/[username]/resume` | ATS-ready resume PDF |

Database: `drizzle/0002_phase_1.sql` adds `profiles`, `projects`, `experiences`, `experience_projects` and `assistant_threads`. It only creates tables (RLS on, no access through the Supabase REST API). Apply it with `npm run db:push`.
