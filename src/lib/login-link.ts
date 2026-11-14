import "server-only";

import { createHash } from "node:crypto";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { loginTokens, profiles, users } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { sendLoginEmail } from "@/lib/email";
import { LOGIN_LINK_TTL_MS, generateLoginToken, hashToken, isRateLimited, loginTokenStatus } from "@/lib/login-token";
import type { SessionUser } from "@/lib/session";

/** IPs are only kept as a salted hash, and only to count requests. */
function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? process.env.AUTH_GITHUB_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Issues a login link for `email` (already normalized and validated) and
 * emails it. Says nothing about whether an account exists or whether the
 * request was rate limited: the caller shows the same message either way.
 */
export async function requestLoginLink(email: string, ip: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOGIN_LINK_TTL_MS);
  const ipHash = hashIp(ip);

  // Housekeeping: rows older than a day are no use even for rate limiting.
  await db.delete(loginTokens).where(lt(loginTokens.createdAt, new Date(now.getTime() - 24 * 60 * 60_000)));

  const [recent] = await db
    .select({
      byEmail: sql<number>`count(*) filter (where ${loginTokens.email} = ${email})::int`,
      byIp: sql<number>`count(*) filter (where ${loginTokens.ipHash} = ${ipHash})::int`,
    })
    .from(loginTokens)
    .where(gt(loginTokens.createdAt, windowStart));

  if (isRateLimited(recent)) {
    console.warn("[auth] login link rate limit reached");
    return;
  }

  const { token, tokenHash } = generateLoginToken();
  await db.insert(loginTokens).values({ tokenHash, email, ipHash, expiresAt: new Date(now.getTime() + LOGIN_LINK_TTL_MS) });
  await sendLoginEmail(email, `${appUrl()}/sign-in/verify?token=${token}`);
}

/**
 * Looks at a token without spending it, for the confirmation page. Opening the
 * link (which mail scanners do on their own) must not use it up.
 */
export async function peekLoginToken(token: string): Promise<{ status: ReturnType<typeof loginTokenStatus>; email: string | null }> {
  const [row] = await db
    .select({ email: loginTokens.email, expiresAt: loginTokens.expiresAt, usedAt: loginTokens.usedAt })
    .from(loginTokens)
    .where(eq(loginTokens.tokenHash, hashToken(token)))
    .limit(1);
  return { status: loginTokenStatus(row, new Date()), email: row?.email ?? null };
}

/**
 * Spends the token. Returns its email exactly once: the single UPDATE is what
 * guarantees that two concurrent confirmations cannot both succeed.
 */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const now = new Date();
  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .returning({ email: loginTokens.email });
  return row?.email ?? null;
}

/**
 * The account for a confirmed email, created on first login. `isNew` tells
 * the caller to send the user to onboarding (no handle chosen yet).
 */
export async function findOrCreateUserByEmail(email: string): Promise<{ user: SessionUser; needsOnboarding: boolean }> {
  await db.insert(users).values({ email, emailVerified: new Date() }).onConflictDoNothing({ target: users.email });

  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, verified: users.emailVerified, handle: profiles.username })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  if (!row.verified) {
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, row.id));
  }
  return {
    user: { id: row.id, name: row.name, email: row.email, image: row.image },
    needsOnboarding: !row.handle,
  };
}
