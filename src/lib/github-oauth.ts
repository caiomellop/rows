import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import type { SessionUser } from "@/lib/session";
import {
  fallbackUsername,
  isUniqueViolation,
  normalizeUsername,
} from "@/lib/username";

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
  /** Whether `email` is verified by GitHub (the public profile email counts). */
  emailVerified: boolean;
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
  let emailVerified = Boolean(email);
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
      const verified =
        emails.find((e) => e.primary && e.verified) ??
        emails.find((e) => e.verified);
      // The emails[0] fallback may be unverified, so don't mark it as verified.
      const chosen = verified ?? emails[0];
      email = chosen?.email ?? null;
      emailVerified = Boolean(verified);
    }
  }

  return { profile, email, emailVerified };
}

async function insertWithFallbackUsername(
  user: typeof users.$inferInsert,
  login: string,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      await db.insert(users).values({ ...user, username: fallbackUsername(login) });
      return;
    } catch (err) {
      if (attempt >= 4 || !isUniqueViolation(err, "users_username_unique")) {
        throw err;
      }
    }
  }
}

export async function upsertGithubUser(input: {
  profile: GithubUser;
  email: string | null;
  emailVerified: boolean;
  accessToken: string;
  scope?: string;
  tokenType?: string;
}): Promise<SessionUser> {
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

  const name = input.profile.name ?? input.profile.login;
  const image = input.profile.avatar_url;

  const username = normalizeUsername(input.profile.login);
  // Only ever set when GitHub says the email is verified; a verified email
  // keeps its original timestamp.
  const emailVerified = input.emailVerified
    ? sql`coalesce(${users.emailVerified}, now())`
    : null;

  if (existing[0]) {
    const userId = existing[0].userId;
    const profileFields = {
      name,
      email: input.email,
      emailVerified,
      image,
    };
    try {
      await db
        .update(users)
        .set({ ...profileFields, username })
        .where(eq(users.id, userId));
    } catch (err) {
      if (!isUniqueViolation(err, "users_username_unique")) throw err;
      // Handle taken by another user: keep ours, never fail the login.
      await db
        .update(users)
        .set(profileFields)
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
      id: userId,
      name,
      email: input.email,
      image,
    };
  }

  const userId = crypto.randomUUID();
  const newUser = {
    id: userId,
    name,
    email: input.email,
    image,
    emailVerified: input.emailVerified ? new Date() : null,
  };
  try {
    await db.insert(users).values({ ...newUser, username });
  } catch (err) {
    if (!isUniqueViolation(err, "users_username_unique")) throw err;
    // Handle taken (e.g. a renamed GitHub login): use a suffixed one.
    await insertWithFallbackUsername(newUser, input.profile.login);
  }

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
    id: userId,
    name,
    email: input.email,
    image,
  };
}
