# 0003. Rewrite the app in Python with FastAPI

Date: 2026-11-17 · Status: Accepted · Linear: CAI-98 (epic CAI-97)

## Context

The owner decided to move the whole app from Next.js and TypeScript to Python with FastAPI. Today the repo has about 13k lines of TypeScript in 141 files. Roughly 5.3k lines are React UI (34 client components), and the rest is server logic: Drizzle schema and migrations, the custom email-link login with a `jose` cookie, the Claude calls in `src/lib/ai.ts`, Resend, résumé import, the voice interview prototype (Deepgram and Apify, ADR 0002), and the Vitest tests.

AGENTS.md section 4 fixes the current stack, and a new runtime, framework or package manager needs an ADR. This is that ADR.

Two parts of the app cannot become Python:

- **Browser code in the interview prototype.** The microphone, the PCM player and the WebSockets to Deepgram (`audio.ts`, `sockets.ts`, `controller.ts` and their helpers, about 2k lines) run in the browser, so they must stay JavaScript.
- **Styling.** Tailwind and the tokens in `globals.css` stay. Only the build tool changes.

## Decision

### Server
- **Runtime:** Python 3.13, **FastAPI**, served by Uvicorn. The code lives in a `prepermint/` Python package, with routes in `prepermint/routes/`, shared logic in `prepermint/lib/` and features in `prepermint/features/<feature>/`. That is the same split as today, just in Python. Vercel finds the app through `[tool.vercel] entrypoint` in `pyproject.toml`.
- **Package manager:** **uv**, with `pyproject.toml` and `uv.lock`. No pip-tools, Poetry or Pipenv.
- **Validation:** **pydantic v2** replaces zod for form data, query and path params, request bodies, settings (`pydantic-settings`) and AI output.
- **Types and lint:** `mypy --strict` and **ruff**, in place of TypeScript strict and ESLint. `Any` and `type: ignore` are not allowed, the same as `any` and `@ts-ignore` today.
- **Tests:** **pytest** with `pytest-asyncio`. External HTTP is mocked at the module boundary with `respx`.

### Database
- **ORM and migrations:** **SQLAlchemy 2** (async) with the **asyncpg** driver, and **Alembic** for migrations.
- **Pooler:** Supabase's transaction pooler (port 6543) does not support prepared statements, so the engine sets `statement_cache_size=0`.
- **Tables:** they keep their current names and their quoted camelCase columns, so no data moves.
- **Alembic baseline:** the first Alembic revision is a baseline equal to Drizzle migration `0005`. On a database Drizzle has already migrated, `alembic stamp` marks it as applied. RLS-on-every-table and the `REVOKE ... FROM anon, authenticated` rule stay, and are written in each Alembic revision.
- **CI drift check:** `alembic check` replaces `drizzle-kit check` and fails CI when the models and the migrations disagree. `drizzle/` is kept as read-only history.

### Auth
- **Library:** **PyJWT**, HS256, with the same `AUTH_SECRET`, cookie name (`pp_session`), claims, lifetime and cookie domain. Sessions issued by the Next.js app stay valid after the switch, so nobody is signed out.
- **Login links:** same rules as today: SHA-256 hash stored, 15-minute TTL, used once, rate-limited per email and per IP.
- **Gate:** `src/proxy.ts` becomes a Starlette middleware that does the host routing and the redirect to sign-in. Every route that touches user data still depends on `require_user()`. Queries always filter by the session user's id.

### Pages
- **Rendering:** server-rendered **Jinja2** templates, with **HTMX** for partial updates: forms, the thread list, the sidebar and inline AI actions. Small interactions, such as the theme toggle and menus, use a few lines of plain JavaScript. There is no SPA framework.
- **Tailwind:** built with the **standalone Tailwind CLI** through the `pytailwindcss` package, so building CSS needs no Node. `globals.css` and its tokens move as they are.
- **Forms:** Server Actions become form posts, parsed with **`python-multipart`** (FastAPI needs it for forms and uploads). Server Actions checked the `Origin` header for free; every POST now checks it too, in one middleware.
- **Icons:** Lucide icons become inline SVG partials, with the hover animation done in CSS. No other icon set.

### External services
- **AI:** the **`anthropic`** Python SDK, with every call in `prepermint/lib/ai.py` and the model IDs as constants there. Prompts stay in `prompts/` as Markdown. Structured output is validated with pydantic. Interview turns stream through `StreamingResponse`.
- **Email:** Resend through **httpx**, as today with `fetch`. No SDK.
- **Résumé import:** PDFs still go to Claude as a document. DOCX goes through **`mammoth`** (the Python package from the same author as the JS one).
- **Résumé PDF output:** `@react-pdf/renderer` becomes **fpdf2**, which is pure Python and needs no system libraries. It is not wired to any route today, so it is ported last.
- **Deepgram and Apify:** same vendors, same calls, same rules as ADR 0002, made with httpx. The warm-up that runs after the response uses FastAPI `BackgroundTasks` in place of `after()`.

### Browser code
- **The interview client:** it stays **TypeScript**, moves to `web/`, and is bundled with **esbuild** into a static file that FastAPI serves.
- **npm:** it stays only as a dev tool for that folder (TypeScript, esbuild and Vitest for the client logic tests). The server has no Node dependency.

### Hosting
- **Vercel**, Python runtime (FastAPI as an ASGI app), in `pdx1`. The domains and preview deploys stay the same.
- **First sub-issue proves this:** a preview deploy with a database query, a streamed response and a background task that runs after the response. If Vercel's Python runtime cannot do one of them, this ADR gets an update before more code is written.

### How we move
- **Parallel build:** the Python app is built next to the Next.js one, one Linear sub-issue and one PR at a time. Next.js keeps serving production until the Python app covers every route. Then one cutover PR switches the Vercel build, and one cleanup PR deletes the TypeScript server and UI code.
- **Cutover safety:** the two apps share the same database and session cookie, so the switch can be rolled back by redeploying the last Next.js build.

## Consequences

- **Easier:** Python's AI and data libraries are available directly. Pydantic models do the work of the zod schemas and the Drizzle types.
- **Harder:**
  - **Two codebases during the move:** for some weeks a feature added to the Next.js app must also be added to the Python one. New feature work should pause, or be limited, until cutover.
  - **Interactivity:** HTMX and templates are less capable than React for rich interactions, and the design in `docs/landing-design-spec.md` has to be rebuilt by hand.
  - **Caching:** the Next.js cache (`cacheComponents`, `updateTag`) goes away. Reads happen on every request until a real need for caching shows up.
  - **Cold starts:** these get slower on Vercel's Python runtime. The first sub-issue measures them.
- **AGENTS.md:** at cutover, sections 4, 5 and 6 are rewritten for the new stack. Examples: `requireUser()` becomes `require_user()`, `zod` becomes pydantic, `schema.ts` becomes `prepermint/db/models.py`, Server Actions become form posts with HTMX, and `.env.example` loses the `NEXT_PUBLIC_` prefix. The Next.js block at the top of AGENTS.md is removed by the owner at that point, not by an agent.
- **Banned until cutover:** agents must not mix the two stacks, for example by calling Python from Next.js or the reverse. They must not add a Python package that is not named here without updating this ADR, and must not change the database schema in either app until cutover. The baseline must stay equal to Drizzle `0005`.

## Update: the package is `prepermint/`, not `app/` (CAI-99, 17 Nov 2026)

- A root-level `app/` folder makes Next.js ignore `src/app` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/src-folder.md`), which would break the production build while both apps live in the repo. The Python package is `prepermint/`. Paths in the sub-issues that say `app/` mean `prepermint/`.
