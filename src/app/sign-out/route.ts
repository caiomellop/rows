import { NextResponse } from "next/server";

import { siteUrl } from "@/lib/app-url";
import { clearSessionCookie } from "@/lib/session";

// POST only: a GET logout can be triggered by any third-party page
// (e.g. <img src="https://app.rows.so/sign-out">).
export async function POST() {
  const response = NextResponse.redirect(`${siteUrl()}/`, { status: 303 });
  clearSessionCookie(response);
  return response;
}
