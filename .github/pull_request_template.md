<!-- Title must start with the Linear issue ID, e.g. "CAI-31: Email-only login". -->

Closes CAI-

## What changed

<!-- 2–5 bullets. What a reviewer needs to know, not a file list. -->

## How to test

<!-- Steps on the Vercel preview, and the tests that cover the acceptance criteria. -->

## Notes

<!-- New dependencies (with why), destructive migrations, new env variables, follow-ups found outside scope. Delete if empty. -->

## Checklist

- [ ] Title starts with `CAI-XX:` and this PR targets `main`
- [ ] Every acceptance criterion of the issue is met, nothing outside its scope
- [ ] `npm run lint`, `npm test` and `npx next build` pass
- [ ] Schema change: migration generated, RLS enabled, `REVOKE` for `anon` / `authenticated` (or no schema change)
- [ ] New env variables added to `.env.example` (or none)
- [ ] Preview checked
- [ ] New decisions recorded in `docs/adr/` (or none)
