/**
 * Usernames (the `/u/[username]` handle)
 * --------------------------------------
 * `users.username` is unique and is synced from the GitHub `login` on every
 * login, lowercased (GitHub logins are case-insensitive, so `Ada` and `ada`
 * must be one handle).
 *
 * GitHub logins can be renamed and then claimed by someone else while the old
 * owner's row still holds the handle, so a collision is possible. Login must
 * never fail because of it:
 *   - new user: fall back to `<login>-<random suffix>`;
 *   - existing user: keep the username they already have.
 * We never take a handle away from another user.
 *
 * When users can pick their own handle, stop syncing it from GitHub (e.g. add a
 * `usernameCustomized` flag and skip the username update for those users).
 */

export function normalizeUsername(login: string) {
  return login.toLowerCase();
}

/** `<login>-<4 hex chars>`, used when the plain login is already taken. */
export function fallbackUsername(login: string) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `${normalizeUsername(login)}-${suffix}`;
}

/**
 * True if `err` is a Postgres unique violation (23505), optionally on a given
 * constraint. Drizzle wraps driver errors, so the code lives on `err.cause`.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  for (
    let current: unknown = err, depth = 0;
    current && typeof current === "object" && depth < 3;
    current = (current as { cause?: unknown }).cause, depth++
  ) {
    const { code, constraint_name } = current as {
      code?: string;
      constraint_name?: string;
    };
    if (code === "23505") {
      return constraint === undefined || constraint_name === constraint;
    }
  }
  return false;
}
