<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Prepermint — rules for coding agents

Prepermint (prepermint.com) is an AI copilot for job candidates. It helps people prepare before an interview (mock interviews by voice, company research), learn after it (review of a real interview, study plan) and improve their résumé and LinkedIn. It never helps secretly during a live interview.

This repo was called **Rows** (the GitHub repository name and the Vercel project may still say so). The old `rows.so` and `app.rows.so` hosts only redirect (308) to `prepermint.com` and `app.prepermint.com`.

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
4. **One agent per issue.** At most **2 issues In Progress** at once in the whole project, and **at most one of them may change `prepermint/db/models.py`**.
5. **Always branch from an up-to-date `main` and target `main`.** No stacked PRs (a PR whose base is another feature branch). Rebase on `main` before asking for merge.
6. **Branch name:** use the issue's Linear branch name (`cai-31-…`) when you can choose it. If your environment names the branch for you (for example `claude/…`), keep it: rule 2 is what links the PR.
7. **Size:** an issue labeled **L** must be split into sub-issues in Linear before any code is written. A PR should be reviewable in one sitting (aim for under ~600 changed lines, excluding generated migration snapshots and lockfiles).
8. **Stay in scope.** Implement the acceptance criteria and nothing else. No drive-by refactors, renames or "while I was here" fixes. If you find a real problem outside scope, mention it in the PR description so it can become an issue.
9. **New dependencies** need one line of justification in the PR description (why it is needed, why the existing code or platform can't do it). Prefer what is already in `pyproject.toml` (or `web/package.json` for browser code).
10. **Merging:** squash merge only, CI must be green, and the branch is deleted after merge. Never push to `main` directly. Never force-push someone else's branch.
11. **Stale work:** a PR with no activity for 3 days is closed. Draft PRs are not a parking lot.

## 3. Workflow for one issue

1. Read the issue in full, including Agent notes, comments and linked issues.
2. Run the checks in rule 3. Move the issue to **In Progress**.
3. `git fetch origin && git switch -c <branch> origin/main`
4. Implement. Commit in small logical steps with clear messages.
5. Before opening the PR, run locally and make them pass:
   ```
   uv run ruff check .
   uv run ruff format --check .
   uv run mypy
   uv run pytest
   ```
   If you changed `web/`, also run `npm run check`, `npm test` and `npm run build` there. If you changed templates or CSS, rebuild `prepermint/static/app.css` (README). Commit the built files.
   If you changed the schema, also run `uv run alembic revision --autogenerate`, review it, and commit the revision.
6. Open the PR against `main` using the template. Fill every section.
7. Check the Vercel preview deploy for the flows your change touches.
8. When merged, add a short comment in the Linear issue: what shipped, the PR, and anything left for later. Move it to **Done** only when every acceptance criterion is met; otherwise say which ones are left.

## 4. Stack

The stack is recorded in `docs/adr/0003-python-fastapi.md`.

| Layer | Choice |
| --- | --- |
| App | Python 3.13, FastAPI, Uvicorn. Pages are Jinja2 templates; HTMX does partial updates |
| Styling | Tailwind CSS 4 (standalone CLI via `pytailwindcss`), design tokens in `prepermint/static/src/app.css`, Lucide icons as SVG partials in `prepermint/templates/icons/` |
| Database | Supabase Postgres, SQLAlchemy 2 (async, `asyncpg`, transaction pooler), Alembic migrations |
| Auth | Custom: email-only magic link + signed JWT cookie (PyJWT, HS256). No auth library, no Supabase Auth |
| Email | Resend over `httpx` (`prepermint/lib/email.py`) |
| AI | Anthropic Claude through the `anthropic` SDK, all calls in `prepermint/lib/ai.py`; validation with pydantic |
| Browser code | TypeScript in `web/` (the voice interview client), bundled with esbuild into `prepermint/static/` |
| Hosting | Vercel, Python runtime (functions in `pdx1`, next to the database in `us-west-2`) |
| Tests | pytest + pytest-asyncio + respx (`tests/`); Vitest for `web/` |
| Package manager | uv (`pyproject.toml`, `uv.lock`). npm only inside `web/`. No pip-tools, Poetry, pnpm or yarn |

`prepermint/middleware.py` does host routing, the session gate and the Origin check on posts, before any route runs. The built CSS and JavaScript in `prepermint/static/` are committed; CI checks they are current.

### Decisions not made yet — do not make them yourself

| Decision | Tracked in |
| --- | --- |
| Voice and transcription stack for mock interviews (realtime voice provider, STT, TTS) | MVP-28 |
| Background job runner for long tasks (transcription, reports, research) | Future ADR |
| Storage for recordings and files | Future ADR (with MVP-33 / MVP-47) |
| Plans, pricing and usage limits | MVP-46 |
| Any AI SDK other than `anthropic` | Needs an ADR |

If your issue needs one of these and the decision is not recorded in `docs/adr/`, stop and say so in the issue. Do not add a vendor, SDK or service on your own.

## 5. Repository map

```
prepermint/
  main.py              The ASGI app: routers, middleware, error handlers
  middleware.py        Host routing, session gate and Origin check (runs before every route)
  settings.py          Environment variables (pydantic-settings)
  routes/              Pages and form posts: site, auth, chat, dashboard
  features/            Feature modules (interview, discovery, resume)
  lib/                 Shared server logic (session, dal, actions, ai, email, app_url…)
  config/              Static config (e.g. chat starters)
  db/models.py         The only place tables are defined
  db/__init__.py       The engine and the per-request session
  templates/           Jinja2 templates; icons/ holds the SVG icon partials
  static/              Built CSS/JS, fonts; static/src/app.css is the Tailwind source
migrations/            Alembic revisions. migrations/helpers.py has lock_down()
web/interview/         Browser code of the voice interview (TypeScript)
prompts/               Long prompts as Markdown
tests/                 pytest
drizzle/               Migrations of the old Next.js app. Read-only history
docs/adr/              Architecture decision records
```

New features with several files go in `prepermint/features/<feature>/` (for example `prepermint/features/interview/`), holding that feature's server logic, prompt helpers, routes and schemas. Templates go in `prepermint/templates/`.

## 6. Code rules

### General
- `mypy --strict` and ruff must pass. No `Any`, no `type: ignore`. Use `object` and narrow it.
- Validate every input from outside the server with pydantic or explicit parsing: form data, route params, query params, request bodies, webhooks, and AI output.
- Form posts are plain HTML forms enhanced with HTMX; they return the fragment they replace. Use JSON routes only for the browser client, streaming endpoints and files (PDF).
- Actions return `ActionResult` (`ok` with an optional message, or an error). Never return raw error messages or stack traces to the client; log the error's type.
- Keep comments for the *why*. Do not leave commented-out code.

### Auth and data access
- Get the user with `require_user` (the `CurrentUser` dependency in `prepermint/lib/dal.py`) in every page, action and route that touches user data. The middleware gates paths, but it is not enough on its own.
- **Every query on user data filters by the session user's id.** Never take a `user_id` from the client, the URL or the request body.
- Put reusable reads and writes in `prepermint/lib/dal.py` or `prepermint/lib/actions.py` (or `prepermint/features/<feature>/` for a new feature). Do not query user tables from templates.
- Every POST passes the Origin check in the middleware. Do not add an exception without a reason in the PR.

### Database
- Tables are defined only in `prepermint/db/models.py`. Ids are `text` UUIDs (`new_id()`). Every user-owned table has `userId` → `users.id` with `ondelete="CASCADE"`, an index that starts with `userId`, and `createdAt` (plus `updatedAt` if rows change). Columns keep the quoted camelCase names of the existing tables.
- **Every revision that creates a table calls `lock_down(op, "<table>")`** (`migrations/helpers.py`): it enables RLS and runs `REVOKE ALL ON TABLE "<table>" FROM anon, authenticated;`. The app connects as the `postgres` role and bypasses RLS; RLS with no policies keeps Supabase's public REST API closed.
- Schema changes: edit `models.py`, run `uv run alembic revision --autogenerate`, review the revision, add `lock_down`, commit it. CI runs `alembic check`. **Never run migrations against production or preview databases yourself**; the project owner applies them.
- Destructive migrations (`DROP`, type changes) must say so in the PR title and description, and must be the only schema change in that PR.
- Use `jsonb` only for data that is read and written as a whole (a generated report, a list of bullets). Data you filter, count or join on gets real columns or its own table.

### AI
- Every model call goes through `prepermint/lib/ai.py` (or a feature module that imports its client). Model IDs are constants in one place; do not hard-code them elsewhere.
- Long or reusable prompts live as Markdown files in `prompts/<area>/<name>.md` (for example `prompts/interviews/interviewer.md`), versioned in git. Changing a prompt is a code change: it goes through a PR.
- Structured output is validated with a pydantic model. If validation fails, fail clearly; do not save half-valid data.
- **Never invent.** The AI must not make up metrics, results, employers, dates or sources. Numbers and achievements come from the candidate (via the Memory / discovery) or from a cited source. Prompts must say this, and features that generate text about the candidate must ask when data is missing.
- Respect the user's Memory: deleted items are never used again; "things to avoid" are applied in every generation.
- API keys are only read on the server. For realtime voice in the browser, the server issues a short-lived token; the real key never reaches the client.
- Record usage per user (tokens, minutes) when the issue asks for it; plans and limits depend on it (MVP-46).
- Prompts that matter (interviewer, gap analysis, feedback report) need a small regression set: example inputs and the expected properties of the output.

### Privacy (LGPD)
- Interview recordings, transcripts, résumés and Memory are personal data. Do not log their content. Log ids and sizes instead.
- No user content is sent to a third party that is not listed in an ADR.
- Recordings need explicit consent and have a retention date by plan (MVP-37, MVP-47). Do not store audio without both.
- Deleting an account deletes all of its data (`ondelete="CASCADE"` plus stored files).

### Environment variables
- Every new variable goes into `.env.example` with a comment saying what it is and where it comes from, in the same PR, and into `prepermint/settings.py`.
- Nothing in `prepermint/settings.py` reaches the browser unless a template prints it. Never print a secret.
- Current variables: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `APP_URL`, `ANTHROPIC_KEYS`, `PROTOTYPE_ENABLED`, `DEEPGRAM_API_KEYS`, `APIFY_TOKEN`, `APP_ENV`, `DIAGNOSTICS_TOKEN`.

### UI
- Clean, neutral, monochrome look. Use the tokens in `prepermint/static/src/app.css` (`bg-page`, `bg-card`, `text-fg`, `text-fg-2`, `border-line`…), not raw hex colors.
- Icons: Lucide line icons through `icon("name")` (templates/icons/; they animate on hover inside a `.has-icon` parent). Do not add another icon set.
- Navigation has two modes, Chat and Dashboard, switched at the top of the sidebar (`prepermint/templates/app/sidebar.html`). New signed-in pages extend `app/layout.html`.
- Interactivity: HTMX first, then a few lines in `prepermint/static/app.js`. No SPA framework.
- UI copy follows the text in the issue exactly. If the issue gives no text, write short, plain English.
- Every interactive element works with the keyboard and has an accessible name.

### Tests
- Add pytest tests for logic in `prepermint/lib` and `prepermint/features`: parsing, validation, token and session handling, scoring, anything with rules or edge cases. Routes are tested over HTTP with FastAPI's `TestClient`.
- Each Gherkin scenario that can be tested without a browser should have a test.
- Do not call real external APIs (Claude, Resend, voice providers, Apify) in tests. Mock them at the module boundary (`monkeypatch`, `respx`).

## 7. Never do this

- Open a second PR or branch for an issue that already has one.
- Target a PR at a branch other than `main`.
- Apply migrations to a shared database yourself, or edit files in `drizzle/` (read-only history).
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
- [ ] ruff, mypy and pytest pass (and `web/` checks when it changed), locally and in CI
- [ ] Schema changes come with an Alembic revision that calls `lock_down` (RLS and `REVOKE` for `anon` / `authenticated`)
- [ ] New env variables are in `.env.example`
- [ ] The Vercel preview was checked for the flows the change touches
- [ ] New decisions (vendor, pattern, structure) are recorded in `docs/adr/`
- [ ] The Linear issue has a comment with what shipped
