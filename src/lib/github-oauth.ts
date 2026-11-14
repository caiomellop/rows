import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import type { SessionUser } from "@/lib/session";
import { normalizeUsername, validateUsername } from "@/lib/username";

function appUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Exact GitHub OAuth callback configured on the OAuth App. */
export function githubCallbackUrl() {
  return `${appUrl()}/auth`;
}

export function githubAuthorizeUrl(state: string) {
  const clientId = process.env.AUTH_GITHUB_ID;
  if (!clientId) throw new Error("AUTH_GITHUB_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: githubCallbackUrl(),
    scope: "read:user user:email",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

type GithubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export async function exchangeGithubCode(code: string) {
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GITHUB_ID / AUTH_GITHUB_SECRET are not set");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: githubCallbackUrl(),
    }),
  });

  const data = (await res.json()) as GithubTokenResponse;
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "GitHub token exchange failed");
  }
  return data;
}

export async function fetchGithubProfile(accessToken: string): Promise<{
  profile: GithubUser;
  email: string | null;
}> {
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "rows-app",
    },
  });
  if (!userRes.ok) {
    throw new Error(`GitHub user fetch failed (${userRes.status})`);
  }
  const profile = (await userRes.json()) as GithubUser;

  let email = profile.email;
  if (!email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "rows-app",
      },
    });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as GithubEmail[];
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        emails[0]?.email ??
        null;
    }
  }

  return { profile, email };
}

/**
 * A free username for a new profile: the GitHub login when it is valid and
 * unclaimed, otherwise the login plus a short random suffix.
 */
async function pickUsername(login: string): Promise<string> {
  const base = normalizeUsername(login).slice(0, 32);
  const candidates = validateUsername(base) === null ? [base] : [];
  for (let i = 0; i < 5; i++) {
    candidates.push(`${base || "dev"}-${crypto.randomUUID().slice(0, 4)}`);
  }
  for (const candidate of candidates) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `dev-${crypto.randomUUID().slice(0, 8)}`;
}

export async function upsertGithubUser(input: {
  profile: GithubUser;
  email: string | null;
  accessToken: string;
  scope?: string;
  tokenType?: string;
}): Promise<{ user: SessionUser; needsInitialSync: boolean }> {
  const providerAccountId = String(input.profile.id);
  const existing = await db
    .select({
      userId: accounts.userId,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, "github"),
        eq(accounts.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);

  const githubName = input.profile.name ?? input.profile.login;
  const image = input.profile.avatar_url;

  if (existing[0]) {
    const userId = existing[0].userId;
    // The name is editable on the profile, so GitHub only fills it when empty.
    await db
      .update(users)
      .set({ email: input.email, image, githubLogin: input.profile.login })
      .where(eq(users.id, userId));
    await db
      .update(users)
      .set({ name: githubName })
      .where(and(eq(users.id, userId), isNull(users.name)));

    // Accounts created before profiles existed have no username yet.
    const [row] = await db
      .select({ name: users.name, username: users.username, lastSyncedAt: users.lastSyncedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row?.username) {
      await db
        .update(users)
        .set({ username: await pickUsername(input.profile.login) })
        .where(eq(users.id, userId));
    }

    await db
      .update(accounts)
      .set({
        access_token: input.accessToken,
        token_type: input.tokenType ?? "bearer",
        scope: input.scope ?? null,
      })
      .where(
        and(
          eq(accounts.provider, "github"),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      );

    return {
      user: { id: userId, name: row?.name ?? githubName, email: input.email, image },
      needsInitialSync: !row?.lastSyncedAt,
    };
  }

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: githubName,
    email: input.email,
    image,
    emailVerified: input.email ? new Date() : null,
    githubLogin: input.profile.login,
    username: await pickUsername(input.profile.login),
  });

  await db.insert(accounts).values({
    userId,
    type: "oauth",
    provider: "github",
    providerAccountId,
    access_token: input.accessToken,
    token_type: input.tokenType ?? "bearer",
    scope: input.scope ?? null,
  });

  return {
    user: { id: userId, name: githubName, email: input.email, image },
    needsInitialSync: true,
  };
}
