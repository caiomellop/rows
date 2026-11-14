import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/session";

function homeUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST() {
  const response = NextResponse.redirect(`${homeUrl()}/`, { status: 303 });
  clearSessionCookie(response);
  return response;
}

/**
 * Logout is POST-only. A GET that clears the cookie could be fired by link
 * prefetch or by another site (logout CSRF), so GET just redirects home
 * without touching the session.
 */
export async function GET() {
  return NextResponse.redirect(`${homeUrl()}/`, { status: 303 });
}
