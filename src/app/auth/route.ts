import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  exchangeGithubCode,
  fetchGithubProfile,
  upsertGithubUser,
} from "@/lib/github-oauth";
import { attachSessionCookie, signSessionToken } from "@/lib/session";

function homeUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * GitHub OAuth callback — Authorization callback URL must be exactly:
 *   https://rows.so/auth
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${homeUrl()}/?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${homeUrl()}/auth/login`);
  }

  const jar = await cookies();
  const expectedState = jar.get("rows_oauth_state")?.value;

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(`${homeUrl()}/?error=invalid_state`);
    response.cookies.set("rows_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  }

  try {
    const token = await exchangeGithubCode(code);
    const { profile, email } = await fetchGithubProfile(token.access_token!);
    const user = await upsertGithubUser({
      profile,
      email,
      accessToken: token.access_token!,
      scope: token.scope,
      tokenType: token.token_type,
    });

    const sessionToken = await signSessionToken(user);
    const response = NextResponse.redirect(`${homeUrl()}/`);
    attachSessionCookie(response, sessionToken);
    response.cookies.set("rows_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${homeUrl()}/?error=${encodeURIComponent(message)}`,
    );
  }
}
