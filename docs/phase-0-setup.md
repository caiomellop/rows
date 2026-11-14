# Phase 0 setup (Caio)

Next.js + Supabase/Drizzle + GitHub OAuth (sem Auth.js).

- Landing: **https://rows.so**
- Sign in: **https://rows.so/auth/signin** (botão Get Started)
- OAuth callback: **https://rows.so/auth**

## Env vars

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret (+ cookie de sessão) |
| `NEXT_PUBLIC_APP_URL` | `https://rows.so` |

## GitHub OAuth App

1. https://github.com/settings/developers
2. **Homepage URL:** `https://rows.so`
3. **Authorization callback URL:** `https://rows.so/auth`

## Fluxo

1. `/` → Get Started → `/auth/signin`
2. Sign in with GitHub → `/auth/login` → GitHub
3. GitHub volta para `/auth?code=...` → cria user no DB → `/`

## Testar

1. Abrir https://rows.so
2. Get Started → Sign in with GitHub
3. Supabase:

```sql
select id, name, email from users order by id desc limit 5;
```
