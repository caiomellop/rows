# Prepermint

AI copilot for job candidates (formerly Rows).

What to build, in what order and with which acceptance criteria lives in Linear: project **Prepermint MVP**, team **CAI**. The rules for working in this repo are in [`AGENTS.md`](./AGENTS.md). The stack is recorded in [ADR 0003](docs/adr/0003-python-fastapi.md).

## Stack

- Python 3.13 + FastAPI, served by Uvicorn; Jinja2 templates with HTMX; Tailwind (standalone CLI)
- Supabase Postgres + SQLAlchemy 2 (asyncpg) + Alembic
- Email-only login with a one-time link (no passwords); email sent through Resend
- Anthropic Claude for the AI features (`prepermint/lib/ai.py`)
- The voice interview's browser code is TypeScript in `web/`, bundled with esbuild into `prepermint/static/`
- Package manager: [uv](https://docs.astral.sh/uv/) for Python; npm only as a dev tool inside `web/`

## Quick start

With uv installed:

1. `cp .env.example .env.local` and fill in the values. Each variable is explained in `.env.example`.
2. `uv sync`
3. `uv run alembic upgrade head` on an empty database, or `uv run alembic stamp 0001_baseline` on one the Next.js app already migrated (see below).
4. `uv run uvicorn prepermint.main:app --reload`, then open http://localhost:8000

Required variables: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM`, `SITE_URL` and `APP_URL`. `ANTHROPIC_KEYS` is optional: without it the AI buttons are hidden. Without `RESEND_API_KEY`, the login link is printed in the server log.

## Hosts

- Site: `https://prepermint.com` (landing, pricing, terms, privacy)
- App: `https://app.prepermint.com` (sign-in, chat, memory, dashboard)
- The login link lands on `https://app.prepermint.com/sign-in/verify`.
- `rows.so`, `www.rows.so` and `app.rows.so` redirect (308) to the same path on the new hosts (`prepermint/middleware.py`).
- A path asked for on the wrong host is redirected to the right one (`prepermint/middleware.py`).

## Checks

```
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
```

Tests that need a database run when `TEST_DATABASE_URL` points at an empty Postgres (CI starts one); without it they are skipped. They never call Claude, Resend, Deepgram or Apify.

The browser code in `web/`:

```
cd web && npm ci && npm run check && npm test
```

## Front-end assets

The built CSS and JavaScript are committed, so a deploy needs no Node. CI fails when they are stale.

| What | Source | Build |
| --- | --- | --- |
| `prepermint/static/app.css` | `prepermint/static/src/app.css` and the class names in `prepermint/templates/` | `TAILWINDCSS_VERSION=v4.3.5 uv run tailwindcss -i prepermint/static/src/app.css -o prepermint/static/app.css --minify` |
| `prepermint/static/interview.js`, `htmx.min.js` | `web/interview/` and the `htmx.org` package | `cd web && npm run build` |
| `prepermint/static/app.js` | itself (plain JavaScript, no build) | none |

## Database migrations

Alembic revisions in `migrations/versions/` are the only way the schema changes. Tables are defined in `prepermint/db/models.py`.

| Command | What it does |
| --- | --- |
| `uv run alembic revision --autogenerate -m "..."` | After editing `models.py`: writes the next revision. Review it, add `lock_down(op, "<table>")` for every new table, and commit it. |
| `uv run alembic upgrade head` | Applies the revisions that are not applied yet to the database in `DATABASE_URL`. |
| `uv run alembic check` | Fails when the models and the revisions disagree. CI runs it. |

`drizzle/` holds the Next.js app's migrations as read-only history. The first Alembic revision, `0001_baseline`, builds exactly the schema they left (same tables, columns, constraint names, indexes, RLS and `REVOKE`).

### One-time switch on a database the Next.js app migrated

Production and previews already have every table, so `upgrade` would try to create them again. Once, on each such database:

1. Take a backup (`pg_dump`, or a Supabase backup).
2. Run `uv run alembic stamp 0001_baseline`. It only records the baseline as applied.
3. Run `uv run alembic upgrade head`. It should apply nothing.
