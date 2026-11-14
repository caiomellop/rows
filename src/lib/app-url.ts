/**
 * Rows is served on two hosts from one deployment:
 *
 * - the site (rows.so): landing, pricing, public profiles, terms;
 * - the app (app.rows.so): sign-in, onboarding, chat, dashboard.
 *
 * `src/proxy.ts` keeps each path on its host. Locally and on preview
 * deployments both URLs are the same origin and nothing is redirected.
 */

const clean = (url: string) => url.replace(/\/$/, "");

/** Origin of the platform, e.g. https://app.rows.so (no trailing slash). */
export function appUrl() {
  return clean(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/** Origin of the public site, e.g. https://rows.so. Defaults to the app origin. */
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

/** "rows.so", for showing a public address. */
export function siteHost() {
  return siteUrl().replace(/^https?:\/\//, "");
}

/** Paths that belong to the app host. Everything else belongs to the site. */
const APP_PATHS = ["/sign-in", "/sign-out", "/onboarding", "/dashboard", "/chat", "/memory"];

const matches = (paths: string[], pathname: string) => paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function isAppPath(pathname: string) {
  return matches(APP_PATHS, pathname);
}

/** App paths that need a session: everything behind the sidebar, plus onboarding. */
const SIGNED_IN_PATHS = ["/onboarding", "/dashboard", "/chat", "/memory"];

export function needsSession(pathname: string) {
  return matches(SIGNED_IN_PATHS, pathname);
}

/**
 * Cookie `Domain` that lets the session set on app.rows.so be read on rows.so
 * too (signed-in nav, the owner's preview of an unpublished profile).
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
