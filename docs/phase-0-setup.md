# Phase 0 setup (Caio)

Scaffold: Next.js App Router + TypeScript + Tailwind, Supabase Postgres via Drizzle, Auth.js (v5) with GitHub. Done when GitHub login creates a row in `users`.

## Env vars — o que é cada uma

São **5 variáveis** (não misturar nomes):

| Variável | O que é | De onde vem |
| --- | --- | --- |
| `DATABASE_URL` | URI do Postgres (Supabase) | Supabase → Project Settings → Database → Connection string (URI). Preferir **Transaction pooler** (porta **6543**). No Vercel: já pode estar setada. |
| `AUTH_SECRET` | Segredo **aleatório** do Auth.js (criptografa cookies/sessão). **Não vem do GitHub.** | Rode: `openssl rand -base64 32` e cole o resultado. |
| `AUTH_GITHUB_ID` | Client ID do OAuth App | GitHub → Settings → Developer settings → OAuth Apps → Client ID |
| `AUTH_GITHUB_SECRET` | Client Secret do OAuth App | Mesmo OAuth App → Generate a new client secret |
| `NEXT_PUBLIC_APP_URL` | URL pública do app | Local: `http://localhost:3000`. Vercel Preview: a URL `*.vercel.app` do deploy. Produção: seu domínio. |

### Confusão comum

- `AUTH_SECRET` ≠ `AUTH_GITHUB_SECRET`
  - `AUTH_SECRET` = string aleatória gerada por você (`openssl rand -base64 32`)
  - `AUTH_GITHUB_SECRET` = o **Client Secret** do app OAuth no GitHub

### No Vercel

Project → Settings → Environment Variables. Marque **Preview** e **Production** para cada uma:

1. `DATABASE_URL` — (você já colocou)
2. `AUTH_SECRET` — resultado de `openssl rand -base64 32`
3. `AUTH_GITHUB_ID` — Client ID
4. `AUTH_GITHUB_SECRET` — Client Secret
5. `NEXT_PUBLIC_APP_URL` — URL do preview/produção (ex. `https://rows-….vercel.app`)

Opcional: `AUTH_URL` = mesmo valor de `NEXT_PUBLIC_APP_URL` se o callback OAuth falhar.

## Local

```bash
cp .env.example .env.local
# preencha as 5 vars
npm run db:push
npm run dev
```

## Supabase schema

```bash
npm run db:push
```

Cria: `users`, `accounts`, `sessions`, `verification_tokens`.

## GitHub OAuth App

1. [OAuth Apps](https://github.com/settings/developers) → New OAuth App
2. **Homepage URL:** `http://localhost:3000` (e/ou URL Vercel)
3. **Authorization callback URL:**  
   - Local: `http://localhost:3000/api/auth/callback/github`  
   - Vercel: `https://SEU-DEPLOY.vercel.app/api/auth/callback/github`  
   (OAuth Apps clássicos têm **um** callback — use a URL que você está testando, ou um app separado para local vs prod)
4. Client ID → `AUTH_GITHUB_ID`; Client Secret → `AUTH_GITHUB_SECRET`

## Testar login

1. Vars setadas (local e/ou Vercel)
2. `db:push` ok
3. Abrir o app → **Sign in with GitHub**
4. No Supabase:

```sql
select id, name, email, image from users order by id desc limit 5;
select "userId", provider, "providerAccountId" from accounts;
```

## Phase 1 note

Só tabelas Auth.js por enquanto. Phase 1 estende `users` e adiciona tabelas de produto + `/dashboard`.
