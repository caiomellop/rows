/** Same shape as a GitHub login: 1–39 chars, letters/digits/single hyphens. */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;

const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "help",
  "login",
  "logout",
  "me",
  "new",
  "pricing",
  "rows",
  "settings",
  "signin",
  "signup",
  "support",
  "u",
  "www",
]);

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(username: string): string | null {
  if (!username) return "Pick a username.";
  if (!USERNAME_RE.test(username)) {
    return "Use 1–39 lowercase letters, numbers or single hyphens (not at the start or end).";
  }
  if (RESERVED.has(username)) return "That username is reserved.";
  return null;
}
