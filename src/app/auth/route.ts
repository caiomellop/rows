import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  exchangeGithubCode,
  fetchGithubProfile,
  githubAuthorizeUrl,
  upsertGithubUser,
} from "@/lib/github-oauth";
import { syncGithubRepos } from "@/lib/github-sync";
import { attachSessionCookie, signSessionToken } from "@/lib/session";

function homeUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * GitHub OAuth — Authorization callback URL must be exactly:
 *   https://rows.so/auth
 *
 * - GET /auth          → start OAuth (redirect to GitHub)
 * - GET /auth?code=…   → callback (exchange code, set session, → /dashboard)
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${homeUrl()}/auth/signin?error=${encodeURIComponent(error)}`,
    );
  }

  // No code → start login (same path GitHub will call back to)
  if (!code) {
    const nextState = crypto.randomUUID();
    const response = NextResponse.redirect(githubAuthorizeUrl(nextState));
    response.cookies.set("rows_oauth_state", nextState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  }

  const jar = await cookies();
  const expectedState = jar.get("rows_oauth_state")?.value;

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(
      `${homeUrl()}/auth/signin?error=invalid_state`,
    );
    response.cookies.set("rows_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  }

  try {
    const token = await exchangeGithubCode(code);
    const { profile, email } = await fetchGithubProfile(token.access_token!);
    const { user, needsInitialSync } = await upsertGithubUser({
      profile,
      email,
      accessToken: token.access_token!,
      scope: token.scope,
      tokenType: token.token_type,
    });

    // First sign-in: pull repos now so the dashboard isn't empty. A failure
    // here must not block sign-in; the dashboard has a "Sync" button.
    if (needsInitialSync) {
      await syncGithubRepos(user.id).catch((err) => {
        console.error("Initial GitHub sync failed", err);
      });
    }

    const sessionToken = await signSessionToken(user);
    const response = NextResponse.redirect(`${homeUrl()}/dashboard`);
    attachSessionCookie(response, sessionToken);
    response.cookies.set("rows_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${homeUrl()}/auth/signin?error=${encodeURIComponent(message)}`,
    );
  }
}
