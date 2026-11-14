import { NextResponse } from "next/server";

import { githubAuthorizeUrl } from "@/lib/github-oauth";

export async function GET() {
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(githubAuthorizeUrl(state));
  response.cookies.set("rows_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
