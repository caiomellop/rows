/** Canonical public origin (no trailing slash). Used for OAuth callback and redirects. */
export function appUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
