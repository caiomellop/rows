# Agent tasks — Phase 0 hardening

Work items found in a review of the repo (2026-11-14). Each task is written so one agent can pick it up with no other context.

## Read first (every agent)

**What the project is.** Rows is a portfolio builder: GitHub sync, experiences, an AI About section, and a public profile at `/u/[username]`. Only Phase 0 exists so far: the landing page and GitHub login. See `README.md` and `docs/phase-0-setup.md`.

**Stack.**
- Next.js 16.4.6, App Router, with `cacheComponents` and `partialPrefetching` turned on.
- React 19.3, TypeScript, Tailwind v4.
- Drizzle ORM on Supabase Postgres, through the transaction pooler.
- GitHub OAuth written by hand (no Auth.js). The session is a JWT made with `jose`, stored in the `rows_session` cookie.

**Next.js warning (from `AGENTS.md`).** This Next.js version has breaking changes compared to your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code, and heed any deprecation notices.

**Key files.**

| File | Role |
| --- | --- |
| `src/app/auth/route.ts` | `GET /auth`: starts OAuth, and also receives GitHub's callback (`?code=&state=`) |
| `src/app/auth/signin/page.tsx` | Sign-in UI; shows `?error=` |
| `src/app/auth/logout/route.ts` | Clears the session cookie (GET and POST) |
| `src/components/landing-cta.tsx` | "Get Started", or "Signed in as … / Sign out" |
| `src/lib/github-oauth.ts` | Authorize URL, code exchange, profile and email fetch, user and account upsert |
| `src/lib/session.ts` | JWT sign and verify, cookie helpers, `getSession()` |
| `src/db/schema.ts` / `src/db/index.ts` | Drizzle schema (`users`, `accounts`) and the DB client |
| `drizzle/0000_odd_fallen_one.sql` | The only migration |

**Setup and verification.**

```bash
npm ci
npm run lint          # passes today
npx next build        # passes today, no env needed
```

To run the app locally without real credentials:

```bash
DATABASE_URL=postgresql://x:x@127.0.0.1:5432/x AUTH_GITHUB_ID=test AUTH_GITHUB_SECRET=testsecret NEXT_PUBLIC_APP_URL=http://localhost:3000 npx next dev
```

Every page renders this way. The real GitHub callback still needs a real OAuth app and a real database.

**Rules.**
- Use one branch and one PR per task. Keep the diff limited to the task.
- `npm run lint` and `npx next build` must pass before you open the PR.
- Never apply schema changes to the production database. Generate migrations only, and leave applying them to a human.
- Don't change the OAuth callback URL. It must stay exactly `https://rows.so/auth`.

## Order and conflicts

Several tasks touch the same files. To avoid merge conflicts, group the work as below.

| Wave | Tasks | Notes |
| --- | --- | --- |
| 1 (parallel) | T1, T2, T3, T7, T8 | T1 also touches `logout/route.ts` and `auth/route.ts` (tiny edit). Merge T1 first; the others rebase. |
| 2 (parallel) | T4, T5 | T4 touches `auth/route.ts`; T5 touches the schema and `github-oauth.ts`. |
| 3 | T6 | Needs T5 merged (it touches the same upsert code) and T3 (for the env var conventions). |
| Blocked | T9 | Waiting on the exact error message from Caio. |

---

## T1 — Shared app-URL helper

**Problem.** The same "app base URL" function is copied three times:
- `appUrl()` in `src/lib/github-oauth.ts`
- `homeUrl()` in `src/app/auth/route.ts`
- `homeUrl()` in `src/app/auth/logout/route.ts`

**Do.**
1. Create `src/lib/app-url.ts` exporting `appUrl()`. It returns `AUTH_URL ?? NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` with any trailing `/` removed.
2. Replace all three copies with an import of it.
3. Don't change behaviour.

**Done when.** `grep -rn "localhost:3000" src` finds only `src/lib/app-url.ts`, and lint and build pass.

---

## T2 — Logout must not be triggered by link prefetch, and must not be cross-site triggerable

**Problem.** `src/components/landing-cta.tsx` renders `<Link href="/auth/logout">`.
- In production, Next.js prefetches visible `<Link>`s, and `partialPrefetching` is on. Prefetching a GET route handler that clears the cookie can log users out without a click.
- A GET logout also lets any other site log users out (logout CSRF).

**Do.**
1. Replace the link with a `<form method="post" action="/auth/logout">` and a submit button. Style the button the same as the current link.
2. In `src/app/auth/logout/route.ts`, remove the `GET` handler, or make it redirect to `/` without clearing the cookie. Keep `POST`, which returns a 303 to `/` and clears the cookie.
3. Check `node_modules/next/dist/docs/` for how `<Link>` prefetch behaves in this version and mention what you found in the PR.

**Done when.**
- Signed in, loading `/` and waiting several seconds does not clear `rows_session`.
- Clicking "Sign out" does clear it.
- To test locally, set a valid cookie by signing a JWT with `jose`: payload `{id, name, email, image}`, HS256, using the same secret as `AUTH_GITHUB_SECRET`.

---

## T3 — Separate session-signing secret

**Problem.** `src/lib/session.ts` signs session JWTs with `AUTH_GITHUB_SECRET`. That couples two credentials: rotating the GitHub OAuth secret logs everyone out, and the GitHub secret doubles as the HMAC key.

**Do.**
1. Add a `SESSION_SECRET` env var: at least 32 random bytes, for example from `openssl rand -base64 32`.
2. Use it in `getSecret()`.
3. Throw a clear error if it's missing. Optionally, for one release, fall back to `AUTH_GITHUB_SECRET` with a `console.warn`, so existing sessions survive the deploy. State in the PR which option you chose.
4. Update `.env.example`, `README.md` ("Required env") and `docs/phase-0-setup.md`. The setup doc currently says "Sem `AUTH_SECRET` separado"; update that line.

**Done when.** Sessions are signed with `SESSION_SECRET`, the docs list it, and lint and build pass. Note in the PR that Vercel needs the new env var for Production and Preview.

---

## T4 — Don't reflect raw error messages on the sign-in page

**Problem.** In the `catch` block of `src/app/auth/route.ts`, `err.message` goes into `/auth/signin?error=…`, and `signin/page.tsx` renders whatever is in `?error=`. React escapes it, so this is not XSS. It still leaks internal messages, such as GitHub token-exchange errors and DB errors, and lets anyone display arbitrary text on the sign-in page.

**Do.**
1. Redirect with short codes only, for example `access_denied`, `invalid_state` and `oauth_failed`.
2. Log the real error server-side with `console.error`.
3. In the sign-in page, map known codes to friendly copy. Unknown codes get a generic "Something went wrong, try again."

**Done when.**
- `/auth/signin?error=<script>hi</script>` shows the generic message.
- `/auth/signin?error=invalid_state` shows the friendly copy.

---

## T5 — Schema: fix drift, add username, fix email handling

All of this touches `src/db/schema.ts`, `src/lib/github-oauth.ts` and `drizzle/`, so one agent does all of it.

**Problems.**
1. **Drift.** Migration `0000` creates `sessions` and `verification_tokens` (left over from Auth.js), but `schema.ts` doesn't define them. The next `db:generate` or `db:push` will try to drop them, or will produce a confusing diff.
2. **No username.** `/u/[username]` (Phase 1) needs a stable handle, and the GitHub `login` isn't stored anywhere.
3. **Email uniqueness breaks login.** `users.email` is `UNIQUE`. A new GitHub user whose email already exists on another user, or an existing user who changes to such an email, makes the insert or update in `upsertGithubUser` throw, and login fails.
4. **Wrong `emailVerified`.** It's set to `new Date()` even when the email came from the `emails[0]` fallback in `fetchGithubProfile`, which may be unverified.

**Do.**
1. **Drift.** These tables are unused. Generate a migration that drops `sessions` and `verification_tokens`. Don't apply it.
2. **Username.**
   - Add `users.username`: text, unique, set from the GitHub `login` on every login.
   - Make `upsertGithubUser` set it on both insert and update.
   - Plan for collisions: the product may later let users rename themselves. Document the choice in a code comment.
3. **Email uniqueness.** Pick one approach and justify it in the PR:
   - drop the unique constraint, or
   - on conflict, store `null` for the email instead of failing.

   Login must never fail because of an email collision.
4. **`emailVerified`.** Return whether the chosen email is verified from `fetchGithubProfile`, and set `emailVerified` only in that case. The public `profile.email` counts as verified.
5. **Migration.** Run `npm run db:generate` with a throwaway `DATABASE_URL`. drizzle-kit only needs it for introspection; generating works from the snapshot. Commit the new SQL file and the snapshot.

**Done when.** `schema.ts` and the migrations agree, the new migration does the drop, adds username and fixes email, and lint and build pass. List the migration in the PR for a human to apply.

---

## T6 — Encrypt stored GitHub access tokens

Depends on T3 and T5 being merged.

**Problem.** `accounts.access_token` is stored in plain text. Phase 1 (repo sync) will use it, so anyone who can read the DB can act as the user on GitHub.

**Do.**
1. Add `src/lib/token-crypto.ts` with `encrypt(plain)` and `decrypt(stored)`.
   - Use AES-256-GCM from `node:crypto`.
   - Use a random 12-byte IV and store `v1:<iv>:<tag>:<ciphertext>` in base64url.
   - The key comes from a new `TOKEN_ENCRYPTION_KEY` env var: 32 bytes, base64.
2. Encrypt in `upsertGithubUser`.
3. Make `decrypt` accept legacy plain-text values (no `v1:` prefix), so existing rows keep working until the user's next login.
4. Add the env var to `.env.example` and the docs.

**Done when.**
- `encrypt` and `decrypt` round-trip correctly.
- Tampering with the stored value makes `decrypt` throw.
- Lint and build pass.
- If T8 has landed, add a unit test for this.

---

## T7 — Tests and CI

**Problem.** The repo has no tests and no CI.

**Do.**
1. Add Vitest.
2. Write unit tests for `src/lib/session.ts`:
   - sign then verify round-trips;
   - a tampered token returns `null`;
   - an expired token returns `null`.

   Mock `next/headers` `cookies()`.
3. Write unit tests for the `fetchGithubProfile` email-picking logic, with `fetch` mocked.
4. Add a GitHub Actions workflow, `.github/workflows/ci.yml`, that runs `npm ci`, `npm run lint`, `npm test` and `npx next build` on PRs.

**Done when.** CI is green on the PR.

---

## T8 — Dependency audit cleanup

**Problem.** `npm audit` reports 12 moderate issues, all in the ESLint tooling chain: `@typescript-eslint/*` pulled in by `eslint-config-next`. None are runtime dependencies.

**Do.**
1. Check whether a non-breaking `npm audit fix`, or a bump of `eslint-config-next` or `typescript-eslint` within this Next major, clears them.
2. Don't run `--force` upgrades that change the Next major version.
3. If nothing clears them cleanly, write that up in the PR and change nothing.

**Done when.** Audit is clean, or the PR explains why the remaining issues are dev-only and acceptable.

---

## T9 — "Critical cryptography error" (BLOCKED: needs info)

**Report.** Caio sees a "critical error on cryptography". We don't yet know where it appears: build, Vercel deploy, browser, server logs, or a security or Dependabot alert.

**Already checked, and not reproduced.**
- `next build` passes.
- In `next dev` with placeholder env, every route works: `/`, `/auth/signin`, `/auth` sending you to GitHub, `/auth` with a bad state, and `/auth/logout`.
- In headless Chromium, logged out and logged in, there are no page or console errors.
- `npm audit` shows no critical findings.
- Node used was v22.

**Not yet checked.** A real GitHub callback with a real code and the Supabase DB. This path runs `crypto.randomUUID()` in `upsertGithubUser` and `signSessionToken`.

**Crypto touch points.**
- `crypto.randomUUID()`: `src/app/auth/route.ts` (OAuth state), `src/lib/github-oauth.ts` (new user id), `src/db/schema.ts` (`$defaultFn`).
- `jose` HS256 sign and verify: `src/lib/session.ts`.

**Do once unblocked.**
1. Get the exact message, stack and environment (local vs. Vercel, and `node -v`).
2. Reproduce it, then fix it.
3. Things to check:
   - Cache Components errors about `crypto.randomUUID()` during prerender. Read `node_modules/next/dist/docs/` for the rules on non-deterministic APIs.
   - A missing or empty `AUTH_GITHUB_SECRET`, or `SESSION_SECRET` after T3, on Vercel.
   - The Node version on Vercel.
   - Whether it's a scanner alert rather than a runtime error.
