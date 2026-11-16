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

/* ------------------------------------------------------------------ */
/* The "Job posting URL" field                                         */
/* ------------------------------------------------------------------ */

/** A share text ("Check out this job at Certara: https://…") is short. Anything longer is the posting itself. */
const MAX_SHARE_TEXT_CHARS = 600;
const SCHEME_LINK = /https?:\/\/[^\s<>"']+/i;
const BARE_LINK = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;
/** Punctuation that ends a sentence, not an address. */
const TRAILING = /[.,;:!?)\]}]+$/;

export const INVALID_LINK_MESSAGE = "Enter the public web address of the posting.";
export const LOOKS_LIKE_TEXT_MESSAGE = "That looks like the text of a posting. Use “Do it by text”.";

export type JobUrlInput = { state: "empty" } | { state: "valid"; url: string } | { state: "invalid"; message: string };

/** The address inside a pasted text: the first one with a scheme, or the one word that looks like an address without it. */
function addressIn(text: string): string | null {
  const withScheme = text.match(SCHEME_LINK)?.[0];
  if (withScheme) return withScheme.replace(TRAILING, "");

  // Without a scheme only "www.…" or "host.tld/path" counts, so "Node.js" or "e.g." are never taken for links.
  const words = text.split(/\s+/).map((word) => word.replace(TRAILING, "")).filter((word) => BARE_LINK.test(word) && (/^www\./i.test(word) || /[/?#]/.test(word)));
  return words.length === 1 ? `https://${words[0]}` : null;
}

/**
 * What the one-line "Job posting URL" field holds: nothing, a public address we are willing to read (returned in
 * full, with https:// added when it was left out), or something else. It runs in the browser on every change, so
 * it costs nothing; the server checks the address again before reading it.
 */
export function parseJobUrlInput(raw: string): JobUrlInput {
  const text = raw.trim();
  if (!text) return { state: "empty" };
  if (text.length > MAX_SHARE_TEXT_CHARS) return { state: "invalid", message: LOOKS_LIKE_TEXT_MESSAGE };

  const address = addressIn(text);
  const url = address ? jobUrlFrom(address) : null;
  return url && isPublicJobUrl(url) ? { state: "valid", url } : { state: "invalid", message: INVALID_LINK_MESSAGE };
}
