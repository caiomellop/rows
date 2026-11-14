/**
 * Public handle rules: rows.so/u/{handle}.
 *
 * GitHub-style: lowercase a–z, 0–9 and single hyphens, 3–39 characters, no
 * hyphen at the start or end. The same rule is enforced in Postgres by the
 * `profiles_username_format` check constraint (keep both in sync).
 *
 * Pure module (no DB access) so it can run on the client for live hints.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 39;

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Handles that would collide with a top-level route, a likely future route,
 * or that could be used to impersonate the product. Every folder directly
 * under `src/app` must be listed here.
 */
const RESERVED = new Set([
  // Current top-level routes
  "auth",
  "discovery",
  "onboarding",
  "pricing",
  "u",
  // Planned routes (dashboard, settings, profile, API, AI-readable layer…)
  "about",
  "account",
  "admin",
  "api",
  "app",
  "assets",
  "billing",
  "blog",
  "careers",
  "contact",
  "dashboard",
  "docs",
  "explore",
  "help",
  "home",
  "jobs",
  "legal",
  "llms",
  "login",
  "logout",
  "me",
  "new",
  "oauth",
  "privacy",
  "profile",
  "profiles",
  "public",
  "resume",
  "robots",
  "search",
  "security",
  "settings",
  "signin",
  "signout",
  "signup",
  "sitemap",
  "static",
  "status",
  "support",
  "team",
  "terms",
  "user",
  "users",
  "waitlist",
  // Brand / impersonation
  "official",
  "root",
  "rows",
  "staff",
  "system",
  "www",
]);

export type HandleError = "required" | "length" | "format" | "reserved";

/** Case-folds what the user typed. Does not rewrite characters. */
export function normalizeHandleInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Best-effort conversion of any string (GitHub login, display name) into a
 * valid-looking handle: strips accents, turns other characters into hyphens,
 * collapses repeats and trims to the max length. May still be reserved or
 * taken; check with `validateHandle` and the database.
 */
export function toHandle(raw: string): string {
  let handle = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/, "");

  if (handle && handle.length < HANDLE_MIN) handle = `${handle}-dev`;
  return handle;
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED.has(handle);
}

/** Returns why the handle is not acceptable, or null when it is. */
export function validateHandle(handle: string): HandleError | null {
  if (!handle) return "required";
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return "length";
  if (!HANDLE_RE.test(handle)) return "format";
  if (isReservedHandle(handle)) return "reserved";
  return null;
}

export const HANDLE_ERROR_MESSAGES: Record<HandleError, string> = {
  required: "Choose a handle.",
  length: `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`,
  format:
    "Use lowercase letters, numbers and single hyphens, not at the start or end.",
  reserved: "This handle is unavailable.",
};

/**
 * Alternative handles to offer when `base` is unavailable, in order of
 * preference. All are valid and not reserved; the caller picks the first one
 * that is free in the database.
 */
export function handleAlternatives(base: string): string[] {
  const root = toHandle(base) || "dev";
  const withSuffix = (suffix: string) =>
    `${root.slice(0, HANDLE_MAX - suffix.length - 1).replace(/-+$/, "")}-${suffix}`;

  const candidates = [
    withSuffix("dev"),
    ...Array.from({ length: 8 }, (_, i) => withSuffix(String(i + 2))),
    withSuffix(crypto.randomUUID().slice(0, 4)),
    withSuffix(crypto.randomUUID().slice(0, 6)),
  ];

  return [...new Set(candidates)].filter(
    (c) => c !== root && validateHandle(c) === null,
  );
}
