import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { appUrl } from "@/lib/app-url";
import {
  exchangeGithubCode,
  fetchGithubProfile,
  githubAuthorizeUrl,
  upsertGithubUser,
} from "@/lib/github-oauth";
import { attachSessionCookie, signSessionToken } from "@/lib/session";

const STATE_COOKIE = "rows_oauth_state";

function signInError(code: string) {
  const response = NextResponse.redirect(
    `${appUrl()}/auth/signin?error=${encodeURIComponent(code)}`,
  );
  response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/**
 * GitHub OAuth — Authorization callback URL must be exactly `${appUrl()}/auth`.
 *
 * - GET /auth          → start OAuth (redirect to GitHub)
 * - GET /auth?code=…   → callback (exchange code, save user, set session)
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[auth] GitHub returned an error:", error);
    return signInError(error === "access_denied" ? "access_denied" : "github");
  }

  // No code → start login (same path GitHub will call back to)
  if (!code) {
    const nextState = crypto.randomUUID();
    const response = NextResponse.redirect(githubAuthorizeUrl(nextState));
    response.cookies.set(STATE_COOKIE, nextState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;

  if (!state || !expectedState || state !== expectedState) {
    console.error("[auth] OAuth state mismatch", {
      host: request.headers.get("host"),
      hasStateParam: Boolean(state),
      hasStateCookie: Boolean(expectedState),
    });
    return signInError("invalid_state");
  }

  // Each step is tagged so a failure in the Vercel logs says exactly where it
  // broke (GitHub vs. database) instead of silently bouncing to /auth/signin.
  let step = "token_exchange";
  try {
    const token = await exchangeGithubCode(code);
    step = "github_profile";
    const { profile, email } = await fetchGithubProfile(token.access_token!);
    step = "database";
    const { user, needsOnboarding } = await upsertGithubUser({
      profile,
      email,
      accessToken: token.access_token!,
      scope: token.scope,
      tokenType: token.token_type,
    });

    const sessionToken = await signSessionToken(user);
    // New users (and anyone who hasn't picked a handle yet) go to onboarding.
    // Returning users go home until the dashboard (MVP-15) exists.
    const response = NextResponse.redirect(
      `${appUrl()}${needsOnboarding ? "/onboarding" : "/"}`,
    );
    attachSessionCookie(response, sessionToken);
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    // Full detail goes to the server logs only; never echo raw error text
    // (it can contain DB host names, SQL, etc.) into the URL or the page.
    console.error(`[auth] sign-in failed at step "${step}":`, err);
    return signInError(step);
  }
}
