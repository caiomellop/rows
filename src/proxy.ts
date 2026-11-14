import { NextResponse, type NextRequest } from "next/server";

import { canViewProfile } from "@/lib/profile-access";
import { isBareHandle, parseHandleSegment } from "@/lib/profile-url";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Gate for the public profile routes (/in/@handle and everything under it).
 *
 * The profile page streams, so by the time it could call `notFound()` the
 * response is already `200`. Deciding here, before rendering starts, is what
 * lets unknown and unpublished handles answer with a real HTTP 404.
 */
export async function proxy(request: NextRequest) {
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
  matcher: "/in/:path+",
};
