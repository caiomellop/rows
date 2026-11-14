# Phase 0 setup (Caio)

Scaffold: Next.js App Router + TypeScript + Tailwind, Supabase Postgres via Drizzle, Auth.js (v5) with GitHub. Done when GitHub login creates a row in `users`.

Production domain: **https://rows.so** (Vercel já aponta para cá).

## Env vars

| Variável | O que é | De onde vem |
| --- | --- | --- |
| `DATABASE_URL` | URI do Postgres (Supabase) | Supabase → Database → Connection string (URI). Preferir **Transaction pooler** (porta **6543**). Já no Vercel. |
| `AUTH_GITHUB_ID` | Client ID do OAuth App | GitHub → OAuth Apps → Client ID |
| `AUTH_GITHUB_SECRET` | Client Secret do OAuth App (também assina a sessão Auth.js) | Mesmo OAuth App → Client secret |
| `NEXT_PUBLIC_APP_URL` | URL pública do app | Prod: `https://rows.so`. Local: `http://localhost:3000` |

### No Vercel

1. `DATABASE_URL` — já setada  
2. `AUTH_GITHUB_ID`  
3. `AUTH_GITHUB_SECRET`  
4. `NEXT_PUBLIC_APP_URL` = `https://rows.so`

Opcional: `AUTH_URL` = `https://rows.so`

## Local

```bash
cp .env.example .env.local
# use NEXT_PUBLIC_APP_URL=http://localhost:3000 no .env.local
npm run db:push
npm run dev
```

## Supabase schema

```bash
npm run db:push
```

Cria: `users`, `accounts`, `sessions`, `verification_tokens`.

## GitHub OAuth App

1. [OAuth Apps](https://github.com/settings/developers) → New OAuth App (ou editar o existente)
2. **Homepage URL:** `https://rows.so`
3. **Authorization callback URL:** `https://rows.so/api/auth/callback/github`  
   Para testar local, use um segundo OAuth App com callback `http://localhost:3000/api/auth/callback/github`, ou troque o callback temporariamente.
4. Client ID → `AUTH_GITHUB_ID`; Client Secret → `AUTH_GITHUB_SECRET`

## Testar login

1. Vars setadas no Vercel
2. `db:push` ok no Supabase
3. Abrir https://rows.so → **Sign in with GitHub**
4. No Supabase:

```sql
select id, name, email, image from users order by id desc limit 5;
select "userId", provider, "providerAccountId" from accounts;
```

## Phase 1 note

Só tabelas Auth.js por enquanto. Phase 1 estende `users` e adiciona tabelas de produto + `/dashboard`.
