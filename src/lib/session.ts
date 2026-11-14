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

let warnedLegacySecret = false;

/**
 * Key used to sign session JWTs (HS256): SESSION_SECRET, at least 32 random
 * bytes (`openssl rand -base64 32`).
 *
 * TEMPORARY: for one release we fall back to AUTH_GITHUB_SECRET (the old
 * signing key) so sessions issued before the deploy stay valid. Remove the
 * fallback once SESSION_SECRET is set everywhere.
 */
function getSecret() {
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    secret = process.env.AUTH_GITHUB_SECRET;
    if (!secret) {
      throw new Error("SESSION_SECRET is not set");
    }
    if (!warnedLegacySecret) {
      warnedLegacySecret = true;
      console.warn(
        "SESSION_SECRET is not set; falling back to AUTH_GITHUB_SECRET to sign sessions. Set SESSION_SECRET (openssl rand -base64 32).",
      );
    }
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

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
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
