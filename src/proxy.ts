import { NextResponse, type NextRequest } from "next/server";

import { appUrl, hostsAreSplit, isAppPath, isSiteHost, needsSession, siteUrl } from "@/lib/app-url";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Two jobs, both of which must happen before a page starts rendering:
 *
 * 1. Host routing. The app (sign-in, chat, dashboard) lives on app.rows.so and
 *    everything else on rows.so; a path asked for on the wrong host is
 *    redirected to the right one.
 * 2. The gate for the signed-in app (chat, memory, dashboard): without a valid
 *    session the visitor is redirected to /sign-in. Pages check the session
 *    again when they read data (src/lib/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The pre-MVP-23 sign-in address.
  if (pathname === "/auth/signin") {
    return NextResponse.redirect(`${appUrl()}/sign-in${search}`, 308);
  }

  const elsewhere = otherHost(request, pathname);
  if (elsewhere) return NextResponse.redirect(`${elsewhere}${search}`, 308);

  if (needsSession(pathname)) {
    const viewer = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!viewer) return NextResponse.redirect(new URL("/sign-in", request.url), 307);
  }

  return NextResponse.next();
}

/** The URL this path should be served from when it was asked for on the wrong host. */
function otherHost(request: NextRequest, pathname: string): string | null {
  if (!hostsAreSplit()) return null;

  const host = request.headers.get("host");
  const onApp = host === new URL(appUrl()).host;

  if (onApp) {
    if (pathname === "/") return `${appUrl()}/chat`;
    if (!isAppPath(pathname)) return `${siteUrl()}${pathname}`;
  } else if (isSiteHost(host) && isAppPath(pathname)) {
    return `${appUrl()}${pathname}`;
  }
  // Any other host (preview deployments, localhost) serves everything.
  return null;
}

export const config = {
  // Everything except build assets and files with an extension.
  matcher: "/((?!_next/|.*\\.[\\w]+$).*)",
};
