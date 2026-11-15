/**
 * Prepermint is served on two hosts from one deployment:
 *
 * - the site (prepermint.com): landing, pricing, terms, privacy;
 * - the app (app.prepermint.com): sign-in, chat, memory, dashboard.
 *
 * `src/proxy.ts` keeps each path on its host. Locally and on preview
 * deployments both URLs are the same origin and nothing is redirected.
 */

const clean = (url: string) => url.replace(/\/$/, "");

/** Origin of the platform, e.g. https://app.prepermint.com (no trailing slash). */
export function appUrl() {
  return clean(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/** Origin of the public site, e.g. https://prepermint.com. Defaults to the app origin. */
export function siteUrl() {
  return clean(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/** True when the app lives on its own host (production). */
export function hostsAreSplit() {
  return appUrl() !== siteUrl();
}

/** Link to an app page. Relative while everything shares one origin. */
export function appHref(path: string) {
  return hostsAreSplit() ? `${appUrl()}${path}` : path;
}

/** Link to a site page. Relative while everything shares one origin. */
export function siteHref(path: string) {
  return hostsAreSplit() ? `${siteUrl()}${path}` : path;
}

/** "prepermint.com", for showing a public address. */
export function siteHost() {
  return siteUrl().replace(/^https?:\/\//, "");
}

/** Paths that belong to the app host. Everything else belongs to the site. */
const APP_PATHS = ["/sign-in", "/sign-out", "/dashboard", "/chat", "/memory"];

const matches = (paths: string[], pathname: string) => paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function isAppPath(pathname: string) {
  return matches(APP_PATHS, pathname);
}

/** App paths that need a session: everything behind the sidebar. */
const SIGNED_IN_PATHS = ["/dashboard", "/chat", "/memory"];

export function needsSession(pathname: string) {
  return matches(SIGNED_IN_PATHS, pathname);
}

/**
 * Cookie `Domain` that lets the session set on app.prepermint.com be read on prepermint.com
 * too (for example, a signed-in nav on the site).
 * Undefined when the hosts are not split or the app is not a subdomain of the site.
 */
export function sessionCookieDomain(): string | undefined {
  if (!hostsAreSplit()) return undefined;
  const site = new URL(siteUrl()).hostname.replace(/^www\./, "");
  const app = new URL(appUrl()).hostname;
  return app.endsWith(`.${site}`) ? site : undefined;
}

/** True when `host` is the site, with or without the www prefix. */
export function isSiteHost(host: string | null) {
  if (!host) return false;
  const site = new URL(siteUrl()).host.replace(/^www\./, "");
  return host === site || host === `www.${site}`;
}

/**
 * Hosts the product used before the rename to Prepermint. They are only kept to
 * redirect (308) to the current hosts; nothing is served on them.
 */
const LEGACY_SITE_HOSTS = ["rows.so", "www.rows.so"];
const LEGACY_APP_HOSTS = ["app.rows.so"];

/**
 * Where a request to an old host should go, or null when `host` is not an old
 * host. Skipped while the configured URLs still point at that host, so the
 * redirect cannot loop before the environment variables are switched.
 */
export function legacyHostTarget(host: string | null, pathname: string): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0];
  const configured = [appUrl(), siteUrl()].map((url) => new URL(url).hostname);
  if (configured.includes(hostname)) return null;

  if (LEGACY_APP_HOSTS.includes(hostname)) return `${appUrl()}${pathname}`;
  if (LEGACY_SITE_HOSTS.includes(hostname)) return `${isAppPath(pathname) ? appUrl() : siteUrl()}${pathname}`;
  return null;
}
