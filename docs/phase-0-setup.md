# Phase 0 setup (Caio)

Next.js + Supabase/Drizzle + GitHub OAuth (**sem Auth.js**).

- Landing: **https://rows.so**
- Sign in: **https://rows.so/auth/signin** (Get Started)
- OAuth start + callback: **https://rows.so/auth**

## Env vars

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret |
| `SESSION_SECRET` | Chave que assina o cookie de sessão (mín. 32 bytes aleatórios: `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | `https://rows.so` |

`SESSION_SECRET` é separado de `AUTH_GITHUB_SECRET`: rodar o secret do GitHub não desloga ninguém. Na Vercel, defina `SESSION_SECRET` em Production **e** Preview. Por uma release, se `SESSION_SECRET` não existir, o app usa `AUTH_GITHUB_SECRET` com um `console.warn` (para as sessões atuais continuarem válidas); depois disso o fallback será removido.

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
