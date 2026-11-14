/**
 * Short error codes passed to /auth/signin?error=<code>. Only these codes are
 * ever put in the URL; raw error messages are logged server-side instead.
 */
export type AuthErrorCode = "access_denied" | "invalid_state" | "oauth_failed";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  access_denied:
    "You cancelled the GitHub sign-in. Try again when you're ready.",
  invalid_state:
    "Your sign-in session expired or didn't match. Please try again.",
  oauth_failed:
    "We couldn't finish signing you in with GitHub. Please try again.",
};

const GENERIC_AUTH_ERROR = "Something went wrong, try again.";

/** Friendly copy for a known code; generic copy for anything else. */
export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code)
    ? AUTH_ERROR_MESSAGES[code as AuthErrorCode]
    : GENERIC_AUTH_ERROR;
}
