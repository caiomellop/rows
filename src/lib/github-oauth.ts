import { appUrl } from "@/lib/app-url";

/**
 * GitHub OAuth helpers. GitHub is no longer a way to sign in (MVP-23: login is
 * email only), so nothing here creates users or sessions. These helpers are
 * kept for connecting GitHub to an existing account as an integration (MVP-24).
 */

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
