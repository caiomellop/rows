import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, profiles, users } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import type { SessionUser } from "@/lib/session";

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

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status})`);
  }
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
 * Create or update the user + GitHub account + profile in a single
 * transaction, so a failure half-way can never leave an orphaned `users` row
 * behind. `needsOnboarding` is true until the user has picked a handle.
 */
export async function upsertGithubUser(input: {
  profile: GithubUser;
  email: string | null;
  accessToken: string;
  scope?: string;
  tokenType?: string;
}): Promise<{ user: SessionUser; needsOnboarding: boolean }> {
  const providerAccountId = String(input.profile.id);
  const name = input.profile.name ?? input.profile.login;
  const image = input.profile.avatar_url;
  const tokenFields = {
    access_token: input.accessToken,
    token_type: input.tokenType ?? "bearer",
    scope: input.scope ?? null,
  };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, "github"),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    // `users.email` is unique. Only keep the GitHub email if no *other* user
    // already owns it, otherwise the insert/update would fail and sign-in
    // would be impossible for this GitHub account.
    let email = input.email;
    if (email) {
      const [owner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (owner && owner.id !== existing?.userId) email = null;
    }

    if (existing) {
      const userId = existing.userId;
      await tx
        .update(users)
        .set(email ? { name, email, image } : { name, image })
        .where(eq(users.id, userId));
      await tx
        .update(accounts)
        .set(tokenFields)
        .where(
          and(
            eq(accounts.provider, "github"),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );
      const needsOnboarding = await upsertProfile(tx, userId, input.profile.login);
      return {
        user: { id: userId, name, email: email ?? input.email, image },
        needsOnboarding,
      };
    }

    const userId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      name,
      email,
      image,
      emailVerified: email ? new Date() : null,
    });
    await tx.insert(accounts).values({
      userId,
      type: "oauth",
      provider: "github",
      providerAccountId,
      ...tokenFields,
    });
    const needsOnboarding = await upsertProfile(tx, userId, input.profile.login);
    return { user: { id: userId, name, email, image }, needsOnboarding };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Keep the profile's GitHub login current (it seeds the suggested handle).
 * Accounts created before profiles existed get their row here on next sign-in.
 * Returns true when no handle has been chosen yet.
 */
async function upsertProfile(tx: Tx, userId: string, githubLogin: string) {
  const [row] = await tx
    .insert(profiles)
    .values({ userId, githubLogin })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { githubLogin, updatedAt: new Date() },
    })
    .returning({ username: profiles.username });
  return !row?.username;
}
