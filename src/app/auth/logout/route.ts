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

export async function GET() {
  const response = NextResponse.redirect(`${homeUrl()}/`);
  clearSessionCookie(response);
  return response;
}
