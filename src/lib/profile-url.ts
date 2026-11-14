/**
 * The public profile lives at rows.so/in/@handle. Client-safe helpers so the
 * URL shape is defined in one place.
 */

/** Same shape the handle is stored in: lowercase letters, digits and hyphens. */
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;

export function profilePath(username: string) {
  return `/in/@${username}`;
}

/**
 * Reads the `[handle]` route segment ("@ada", or "%40ada" when a client
 * percent-encodes the @). Returns the bare lowercase handle, or null when the
 * segment is not a well-formed `@handle`.
 */
export function parseHandleSegment(segment: string): string | null {
  let value = segment;
  try {
    value = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (!value.startsWith("@")) return null;
  const handle = value.slice(1).toLowerCase();
  return HANDLE.test(handle) ? handle : null;
}

/** True for a bare handle without the @ ("ada"), so `/in/ada` can redirect. */
export function isBareHandle(segment: string) {
  return HANDLE.test(segment.toLowerCase());
}
