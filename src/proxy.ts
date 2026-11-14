import { NextResponse, type NextRequest } from "next/server";

import { appUrl, hostsAreSplit, isAppPath, isSiteHost, needsSession, siteUrl } from "@/lib/app-url";
import { canViewProfile } from "@/lib/profile-access";
import { isBareHandle, parseHandleSegment } from "@/lib/profile-url";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Three jobs, all of which must happen before a page starts rendering:
 *
 * 1. Host routing. The app (sign-in, onboarding, dashboard) lives on
 *    app.rows.so and everything else on rows.so; a path asked for on the wrong
 *    host is redirected to the right one.
 * 2. The gate for the signed-in app (chat, dashboard, onboarding): without a
 *    valid session the visitor is redirected to /sign-in. Pages check the
 *    session again when they read data (src/lib/dal.ts).
 * 3. The gate for public profiles (/in/@handle), so unknown and unpublished
 *    handles answer with a real HTTP 404 instead of a streamed 200.
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

  if (pathname.startsWith("/in/")) return profileGate(request);
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

async function profileGate(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, , segment = "", ...rest] = pathname.split("/");
  const tail = rest.length ? `/${rest.join("/")}` : "";

  const handle = parseHandleSegment(segment);
  if (!handle) {
    // /in/ada → /in/@ada
    if (isBareHandle(segment)) {
      return NextResponse.redirect(new URL(`/in/@${segment.toLowerCase()}${tail}${search}`, request.url), 308);
    }
    return notFound(request);
  }

  // One canonical spelling: /in/@Ada → /in/@ada. A percent-encoded @ (%40) is
  // served as is: some clients always encode it, and redirecting would loop.
  if (decodeURIComponent(segment) !== `@${handle}`) {
    return NextResponse.redirect(new URL(`/in/@${handle}${tail}${search}`, request.url), 308);
  }

  const viewer = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (await canViewProfile(handle, viewer?.id ?? null)) return NextResponse.next();
  return notFound(request);
}

/** Renders the app's not-found page with a 404 status. */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}

export const config = {
  // Everything except build assets and files with an extension.
  matcher: "/((?!_next/|.*\\.[\\w]+$).*)",
};
