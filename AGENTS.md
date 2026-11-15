<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Prepermint — rules for coding agents

Prepermint (prepermint.com) is an AI copilot for job candidates. It helps people prepare before an interview (mock interviews by voice, company research), learn after it (review of a real interview, study plan) and improve their résumé and LinkedIn. It never helps secretly during a live interview.

This repo was called **Rows**. The rename is tracked in MVP-50. Until it lands, "Rows" in code and copy means Prepermint.

Read this whole file before you change anything. If a rule here conflicts with a request, stop and ask instead of picking one.

## 1. Where the truth lives

| What | Where |
| --- | --- |
| What to build, priorities, acceptance criteria | Linear, project **Prepermint MVP**, team **CAI** |
| Why the code is the way it is | `docs/adr/` (architecture decision records) |
| How to work in this repo | This file |
| Visual design for marketing pages | `docs/landing-design-spec.md` |

Linear is the only task list. Do not keep plans, TODO lists or roadmaps in the repo.

Each Linear issue has a user story, Gherkin acceptance criteria, "Fora de escopo" (out of scope) and a collapsible **Agent notes** section with technical requirements and dependencies. The acceptance criteria are the spec. Issues are written in Portuguese; code, comments, commits and PRs are in English.

## 2. The pipeline (non-negotiable)

These rules exist because on 13–14 Nov 2026 the repo collected 23 branches and 20 PRs: several agents built the same feature in parallel, PRs targeted other branches, and nothing was cleaned up. Do not repeat it.

1. **One Linear issue = one branch = one PR.** Never put two issues in one PR. Never split one issue across PRs unless the issue has sub-issues, each with its own PR.
2. **PR title starts with the issue ID**, for example `CAI-31: Email-only login`. The PR description contains `Closes CAI-31`. This is how Linear links the PR, whatever the branch is called.
3. **Before you start**, check in Linear that:
   - the issue is **Todo** or **In Progress** and assigned to this work,
   - every issue in its "blocked by" list is **Done**,
   - no open PR already exists for it (`gh pr list --search CAI-31`).
   If any check fails, stop and report. Do not start a parallel implementation.
4. **One agent per issue.** At most **2 issues In Progress** at once in the whole project, and **at most one of them may change `src/db/schema.ts`**.
5. **Always branch from an up-to-date `main` and target `main`.** No stacked PRs (a PR whose base is another feature branch). Rebase on `main` before asking for merge.
6. **Branch name:** use the issue's Linear branch name (`cai-31-…`) when you can choose it. If your environment names the branch for you (for example `claude/…`), keep it: rule 2 is what links the PR.
7. **Size:** an issue labeled **L** must be split into sub-issues in Linear before any code is written. A PR should be reviewable in one sitting (aim for under ~600 changed lines, excluding generated migration snapshots and lockfiles).
8. **Stay in scope.** Implement the acceptance criteria and nothing else. No drive-by refactors, renames or "while I was here" fixes. If you find a real problem outside scope, mention it in the PR description so it can become an issue.
9. **New dependencies** need one line of justification in the PR description (why it is needed, why the existing code or platform can't do it). Prefer what is already in `package.json`.
10. **Merging:** squash merge only, CI must be green, and the branch is deleted after merge. Never push to `main` directly. Never force-push someone else's branch.
11. **Stale work:** a PR with no activity for 3 days is closed. Draft PRs are not a parking lot.

## 3. Workflow for one issue

1. Read the issue in full, including Agent notes, comments and linked issues.
2. Run the checks in rule 3. Move the issue to **In Progress**.
3. `git fetch origin && git switch -c <branch> origin/main`
4. Implement. Commit in small logical steps with clear messages.
5. Before opening the PR, run locally and make them pass:
   ```
   npm run lint
   npm test
   npx next build
   ```
   If you changed the schema, also run `npm run db:generate` and commit the generated migration and snapshot.
6. Open the PR against `main` using the template. Fill every section.
7. Check the Vercel preview deploy for the flows your change touches.
8. When merged, add a short comment in the Linear issue: what shipped, the PR, and anything left for later. Move it to **Done** only when every acceptance criterion is met; otherwise say which ones are left.

## 4. Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript strict |
| Styling | Tailwind CSS 4, design tokens in `src/app/globals.css`, Lucide icons via `src/components/icons` |
| Database | Supabase Postgres, accessed with Drizzle ORM (`postgres` driver, transaction pooler) |
| Auth | Custom: email-only magic link + signed JWT cookie (`jose`). No Auth.js, no Supabase Auth |
| Email | Resend (`src/lib/email.ts`) |
| AI | Anthropic Claude through `@anthropic-ai/sdk`, all calls in `src/lib/ai.ts`; validation with `zod` |
| Hosting | Vercel (functions in `pdx1`, next to the database in `us-west-2`) |
| Tests | Vitest (`src/**/*.test.ts`) |
| Package manager | npm (`package-lock.json`). Do not add pnpm or yarn lockfiles |

Next.js 16 differs from what you were trained on. `src/proxy.ts` replaces `middleware.ts`. Caching uses `cacheLife` / `cacheTag` / `updateTag`. Read the guide in `node_modules/next/dist/docs/` before using an API you are not sure about (see the block at the top of this file).

### Decisions not made yet — do not make them yourself

| Decision | Tracked in |
| --- | --- |
| Voice and transcription stack for mock interviews (realtime voice provider, STT, TTS) | MVP-28 |
| Background job runner for long tasks (transcription, reports, research) | Future ADR |
| Storage for recordings and files | Future ADR (with MVP-33 / MVP-47) |
| Plans, pricing and usage limits | MVP-46 |
| Any AI SDK other than `@anthropic-ai/sdk` | Needs an ADR |

If your issue needs one of these and the decision is not recorded in `docs/adr/`, stop and say so in the issue. Do not add a vendor, SDK or service on your own.

## 5. Repository map

```
src/
  app/                 Routes. (app)/ is the signed-in app (Chat, Dashboard, Memory)
  components/          UI components, grouped by area (app-shell, chat, dashboard, icons…)
  config/              Static config (e.g. chat starters)
  db/schema.ts         The only place tables are defined
  db/index.ts          The Drizzle client
  lib/                 Server and shared logic (session, dal, ai, email, app-url…)
  proxy.ts             Host routing and the session gate (runs before rendering)
drizzle/               Generated migrations and snapshots. Never edit by hand
docs/adr/              Architecture decision records
```

New features with several files go in `src/features/<feature>/` (for example `src/features/interviews/`), holding that feature's server logic, prompts helpers and components. Routes stay in `src/app/`. Do not move existing code into `src/features/` unless your issue asks for it.

## 6. Code rules

### General
- TypeScript strict. No `any`, no `@ts-ignore`. Use `unknown` and narrow it.
- Validate every input from outside the server with `zod`: form data, route params, search params, request bodies, webhooks, and AI output.
- Server-only modules import `"server-only"` at the top (`dal.ts`, `ai.ts`, `email.ts`, anything that reads secrets or the database).
- Prefer Server Components and Server Actions. Use Route Handlers only for webhooks, streaming endpoints and files (PDF).
- Server Actions return `{ ok: true } | { ok: false, error }` (see `ActionResult`). Never return raw error messages or stack traces to the client.
- Keep comments for the *why*. Do not leave commented-out code.

### Auth and data access
- Get the user with `requireUser()` from `src/lib/dal.ts` at the start of every page, action and route that touches user data. `proxy.ts` gates routes, but it is not enough on its own.
- **Every query on user data filters by the session user's id.** Never take a `userId` from the client, the URL or the request body.
- Put reusable reads and writes in `src/lib/dal.ts` (or `src/features/<feature>/data.ts` for a new feature). Do not query user tables from components.
- After a write, refresh cached reads with `updateTag(userTag(userId))`.

### Database
- Tables are defined only in `src/db/schema.ts`. Ids are `text` UUIDs (`crypto.randomUUID()`). Every user-owned table has `userId` → `users.id` with `onDelete: "cascade"`, an index that starts with `userId`, and `createdAt` (plus `updatedAt` if rows change).
- **Every table calls `.enableRLS()`**, and the migration that creates it revokes access from the public API roles:
  `REVOKE ALL ON TABLE "<table>" FROM anon, authenticated;`
  The app connects as the `postgres` role and bypasses RLS; RLS with no policies keeps Supabase's public REST API closed.
- Schema changes: edit `schema.ts`, run `npm run db:generate`, review the SQL, commit the migration and the snapshot. **Never run `db:push` against production or preview databases.** Migrations are applied by the project owner until MVP-04 adds `db:migrate`.
- Destructive migrations (`DROP`, type changes) must say so in the PR title and description, and must be the only schema change in that PR.
- Use `jsonb` only for data that is read and written as a whole (a generated report, a list of bullets). Data you filter, count or join on gets real columns or its own table.

### AI
- Every model call goes through `src/lib/ai.ts` (or a feature module that imports its client). Model IDs are constants in one place; do not hard-code them elsewhere.
- Long or reusable prompts live as Markdown files in `prompts/<area>/<name>.md` (for example `prompts/interviews/interviewer.md`), versioned in git. Changing a prompt is a code change: it goes through a PR.
- Structured output is validated with a `zod` schema. If validation fails, fail clearly; do not save half-valid data.
- **Never invent.** The AI must not make up metrics, results, employers, dates or sources. Numbers and achievements come from the candidate (via the Memory / discovery) or from a cited source. Prompts must say this, and features that generate text about the candidate must ask when data is missing.
- Respect the user's Memory: deleted items are never used again; "things to avoid" are applied in every generation.
- API keys are only read on the server. For realtime voice in the browser, the server issues a short-lived token; the real key never reaches the client.
- Record usage per user (tokens, minutes) when the issue asks for it; plans and limits depend on it (MVP-46).
- Prompts that matter (interviewer, gap analysis, feedback report) need a small regression set: example inputs and the expected properties of the output.

### Privacy (LGPD)
- Interview recordings, transcripts, résumés and Memory are personal data. Do not log their content. Log ids and sizes instead.
- No user content is sent to a third party that is not listed in an ADR.
- Recordings need explicit consent and have a retention date by plan (MVP-37, MVP-47). Do not store audio without both.
- Deleting an account deletes all of its data (`onDelete: "cascade"` plus stored files).

### Environment variables
- Every new variable goes into `.env.example` with a comment saying what it is and where it comes from, in the same PR.
- `NEXT_PUBLIC_*` variables are visible to everyone. Never put a secret in one.
- Current variables: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_KEYS`.

### UI
- Clean, neutral, monochrome look. Use the tokens in `globals.css` (`bg-page`, `bg-card`, `text-fg`, `text-fg-2`, `border-line`…), not raw hex colors.
- Icons: Lucide line icons through `src/components/icons` (they animate on hover). Do not add another icon set.
- Navigation has two modes, Chat and Dashboard, switched at the top of the sidebar (`src/components/app-shell`). New signed-in pages fit into that shell.
- UI copy follows the text in the issue exactly. If the issue gives no text, write short, plain English.
- Every interactive element works with the keyboard and has an accessible name.

### Tests
- Add Vitest tests for logic in `src/lib` and `src/features`: parsing, validation, token and session handling, scoring, anything with rules or edge cases.
- Each Gherkin scenario that can be tested without a browser should have a test.
- Do not call real external APIs (Claude, Resend, voice providers) in tests. Mock them at the module boundary.

## 7. Never do this

- Open a second PR or branch for an issue that already has one.
- Target a PR at a branch other than `main`.
- Run `db:push` against a shared database, or edit files in `drizzle/` by hand.
- Add a vendor, SDK, service or package manager not covered by this file or an ADR.
- Rebuild features that were cancelled in the pivot: the public profile (`/in/@handle`), GitHub login or sync, project cards, the handle.
- Remove or edit the Next.js block at the top of this file.
- Put secrets in client code, `NEXT_PUBLIC_*` variables, logs or commits.
- Generate candidate achievements or numbers the candidate did not give.
- Mark a Linear issue Done when acceptance criteria are not all met.

## 8. Definition of done

A PR is ready to merge when:

- [ ] Title starts with `CAI-XX:` and the description says `Closes CAI-XX`
- [ ] It implements every acceptance criterion of the issue, and nothing outside its scope
- [ ] `npm run lint`, `npm test` and `npx next build` pass, locally and in CI
- [ ] Schema changes come with a generated migration, RLS enabled and `REVOKE` for `anon` / `authenticated`
- [ ] New env variables are in `.env.example`
- [ ] The Vercel preview was checked for the flows the change touches
- [ ] New decisions (vendor, pattern, structure) are recorded in `docs/adr/`
- [ ] The Linear issue has a comment with what shipped
