/**
 * The app has two modes, each with its own sidebar navigation. The mode comes
 * from the URL, never from client state, so a reload or a shared link keeps it.
 */
export type AppMode = "chat" | "dashboard";

export const MODE_HOME: Record<AppMode, string> = { chat: "/chat", dashboard: "/dashboard" };

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** /dashboard and below is Dashboard; the rest of the app (/chat, /memory) is Chat. */
export function modeFor(pathname: string): AppMode {
  return under(pathname, "/dashboard") ? "dashboard" : "chat";
}

/**
 * True when a sidebar item is the current page. A mode's home (/chat,
 * /dashboard) only matches exactly, or every page below it would light it up.
 */
export function isActive(pathname: string, href: string) {
  return Object.values(MODE_HOME).includes(href) ? pathname === href : under(pathname, href);
}
