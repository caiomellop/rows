# Phase 0 setup (Caio)

Next.js + Supabase/Drizzle + GitHub OAuth (sem Auth.js). Done when GitHub login creates a row in `users`.

Production: **https://rows.so**

## Env vars

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret (+ assina cookie de sessão) |
| `NEXT_PUBLIC_APP_URL` | `https://rows.so` |

## GitHub OAuth App

1. https://github.com/settings/developers
2. **Homepage URL:** `https://rows.so`
3. **Authorization callback URL:** `https://rows.so/auth`

Só isso. Local: `http://localhost:3000/auth`

## Fluxo

1. `/auth/login` → GitHub
2. GitHub volta para `/auth?code=...`
3. App cria/atualiza `users` + `accounts` e seta cookie

## Testar

Abrir https://rows.so → Sign in with GitHub → conferir no Supabase:

```sql
select id, name, email from users order by id desc limit 5;
```
