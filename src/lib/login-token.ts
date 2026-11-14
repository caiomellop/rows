import { createHash, randomBytes } from "node:crypto";

/**
 * Pure rules for the email login link (no DB, no network), so they can be
 * unit-tested. The database side lives in `login-link.ts`.
 */

export const LOGIN_LINK_TTL_MINUTES = 15;
export const LOGIN_LINK_TTL_MS = LOGIN_LINK_TTL_MINUTES * 60_000;

/** Requests allowed per rolling window of LOGIN_LINK_TTL_MS. */
export const MAX_REQUESTS_PER_EMAIL = 3;
export const MAX_REQUESTS_PER_IP = 10;

/** SHA-256 hex. Only this is stored; the raw token exists only in the email. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A 32-byte random token (base64url) and the hash to store for it. */
export function generateLoginToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Accounts are keyed by the trimmed, lowercased address. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Deliberately simple: one @, something on each side, a dot in the domain. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export type LoginTokenState = { expiresAt: Date; usedAt: Date | null };

/** A link works once, and only until it expires. */
export function loginTokenStatus(row: LoginTokenState | null | undefined, now: Date): "valid" | "expired" | "used" | "unknown" {
  if (!row) return "unknown";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** True when one more request would exceed the per-email or per-IP limit. */
export function isRateLimited(recent: { byEmail: number; byIp: number }): boolean {
  return recent.byEmail >= MAX_REQUESTS_PER_EMAIL || recent.byIp >= MAX_REQUESTS_PER_IP;
}

/** Where an expired, used or unknown link sends the user, with the email prefilled when it is known. */
export function expiredLinkUrl(email: string | null): string {
  return `/auth/signin?error=expired${email ? `&email=${encodeURIComponent(email)}` : ""}`;
}
