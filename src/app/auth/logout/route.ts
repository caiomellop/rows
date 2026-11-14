import { NextResponse } from "next/server";

import { appUrl } from "@/lib/app-url";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  const response = NextResponse.redirect(`${appUrl()}/`, { status: 303 });
  clearSessionCookie(response);
  return response;
}

export async function GET() {
  const response = NextResponse.redirect(`${appUrl()}/`);
  clearSessionCookie(response);
  return response;
}
