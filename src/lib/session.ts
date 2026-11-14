import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const COOKIE_NAME = "rows_session";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

/**
 * Key used to sign session cookies. Set a dedicated AUTH_SECRET
 * (`openssl rand -base64 32`) so rotating the GitHub client secret doesn't
 * invalidate sessions and the OAuth secret isn't reused for a second purpose.
 * Falls back to AUTH_GITHUB_SECRET so existing deployments keep working.
 */
function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.AUTH_GITHUB_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET (or AUTH_GITHUB_SECRET) is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Signs the user in from a Server Action (no NextResponse to attach to). */
export async function startSession(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, await signSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export const SESSION_COOKIE = COOKIE_NAME;

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}

/** Verifies a raw session cookie value. Usable where `cookies()` is not (Proxy). */
export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.id !== "string") return null;
    return {
      id: payload.id,
      name: typeof payload.name === "string" ? payload.name : null,
      email: typeof payload.email === "string" ? payload.email : null,
      image: typeof payload.image === "string" ? payload.image : null,
    };
  } catch {
    return null;
  }
}
