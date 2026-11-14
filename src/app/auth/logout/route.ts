import { NextResponse } from "next/server";

import { appUrl } from "@/lib/app-url";
import { clearSessionCookie } from "@/lib/session";

// POST only: a GET logout can be triggered by any third-party page
// (e.g. <img src="https://rows.so/auth/logout">).
export async function POST() {
  const response = NextResponse.redirect(`${appUrl()}/`, { status: 303 });
  clearSessionCookie(response);
  return response;
}
