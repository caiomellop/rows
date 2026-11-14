# Phase 0 setup (Caio)

> **Desatualizado em parte (MVP-23):** o login agora é só por e-mail, com link de uso único (`/auth/signin` → e-mail → `/auth/verify`). A rota `/auth` do OAuth foi removida e o GitHub deixa de criar conta ou sessão; ele volta como integração no MVP-24. Variáveis novas: `RESEND_API_KEY` e `EMAIL_FROM`. O que segue descreve a Fase 0 original.


Next.js + Supabase/Drizzle + GitHub OAuth (**sem Auth.js**).

- Landing: **https://rows.so**
- Sign in: **https://rows.so/auth/signin** (Get Started)
- OAuth start + callback: **https://rows.so/auth**

## Env vars

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret (+ cookie de sessão) |
| `NEXT_PUBLIC_APP_URL` | `https://rows.so` |

Sem `AUTH_SECRET` separado.

## GitHub OAuth App (obrigatório)

1. https://github.com/settings/developers
2. **Homepage URL:** `https://rows.so`
3. **Authorization callback URL:** `https://rows.so/auth`  
   (exatamente isso — **não** `/api/auth/callback/github`, **não** `/auth/callback/github`)

## Rotas (lean)

| Path | Role |
| --- | --- |
| `/` | Landing |
| `/auth/signin` | UI de sign-in |
| `/auth` | Inicia OAuth **e** recebe o callback do GitHub |
| `/auth/logout` | Limpa sessão |

## Fluxo

1. `/` → Get Started → `/auth/signin`
2. Sign in with GitHub → `/auth` → GitHub
3. GitHub volta para `/auth?code=…` → cria user no DB → `/`

## Testar

1. Abrir https://rows.so
2. Get Started → Sign in with GitHub
3. Supabase:

```sql
select id, name, email from users order by id desc limit 5;
```
