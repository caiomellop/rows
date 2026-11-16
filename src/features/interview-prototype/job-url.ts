/**
 * Telling a link from pasted text in the job description field, and refusing addresses we should not
 * read. It holds no secrets and no server code, so the form and the job route share it.
 */

export const MAX_JOB_URL_LENGTH = 2_000;

/** The link, when the whole field is one http(s) address. Pasted text (anything with a space in it) is not a link. */
export function jobUrlFrom(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > MAX_JOB_URL_LENGTH || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOCAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/;

/**
 * A public web address: no login in it, no unusual port, no IP number and no local or internal name.
 * The page is read by Apify, not by us, but there is no reason to spend money reading those.
 */
export function isPublicJobUrl(value: string): boolean {
  const href = jobUrlFrom(value);
  if (!href) return false;
  const url = new URL(href);
  const host = url.hostname.toLowerCase();
  if (url.username || url.password) return false;
  // A URL drops the port of its own scheme, so any port left over is an unusual one.
  if (url.port) return false;
  if (!host.includes(".") || host.includes(":")) return false;
  return !IPV4.test(host) && !LOCAL_NAME.test(host);
}
