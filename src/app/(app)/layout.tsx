import { cache, Suspense } from "react";

import { AccountMenu } from "@/components/app-shell/account-menu";
import { PublicPageLink, PublicPagePending, Sidebar, SidebarFallback } from "@/components/app-shell/sidebar";
import { ThreadList, type ThreadItem } from "@/components/app-shell/thread-list";
import { siteHref } from "@/lib/app-url";
import { ensureProfile, listThreads, requireUser, type ThreadSummary } from "@/lib/dal";
import { profilePath } from "@/lib/profile-url";

// AI replies, drafting and GitHub sync run inside Server Actions on these pages.
export const maxDuration = 60;

/**
 * The one layout for the signed-in app: the sidebar plus the page. Chat
 * (/chat, /memory) and Dashboard (/dashboard/*) share it; which navigation the
 * sidebar shows comes from the URL (src/lib/app-mode.ts).
 *
 * Everything that reads the session sits behind Suspense, so the frame is
 * static. A visitor without a session is sent to /sign-in by src/proxy.ts
 * before any of this renders; `requireUser` is the second check.
 */
const viewer = cache(async () => {
  const user = await requireUser();
  const profile = await ensureProfile(user);
  return { user, profile };
});

const publicHref = (username: string) => siteHref(profilePath(username));

function threadItem(t: ThreadSummary, now: Date): ThreadItem {
  const sameYear = t.updatedAt.getFullYear() === now.getFullYear();
  const date = t.updatedAt.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" });
  return { id: t.id, title: t.title, date };
}

async function Threads() {
  const { user } = await viewer();
  const { pinned, recent } = await listThreads(user.id);
  const now = new Date();
  return <ThreadList pinned={pinned.map((t) => threadItem(t, now))} recent={recent.map((t) => threadItem(t, now))} />;
}

async function Account() {
  const { user, profile } = await viewer();
  return (
    <AccountMenu
      account={{
        handle: profile.username,
        name: profile.displayName ?? user.name,
        email: user.email,
        image: user.image,
        publicHref: publicHref(profile.username),
      }}
    />
  );
}

async function PublicPage() {
  const { profile } = await viewer();
  return <PublicPageLink href={publicHref(profile.username)} />;
}

const pulse = "animate-pulse rounded-lg bg-ink/[0.05]";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-shell flex min-h-dvh flex-1 flex-col bg-page md:flex-row">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar
          threads={
            <Suspense fallback={<div aria-busy className={`h-24 ${pulse}`} />}>
              <Threads />
            </Suspense>
          }
          account={
            <Suspense fallback={<div aria-busy className={`h-9 min-w-0 flex-1 ${pulse}`} />}>
              <Account />
            </Suspense>
          }
          publicPage={
            <Suspense fallback={<PublicPagePending />}>
              <PublicPage />
            </Suspense>
          }
        />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col px-4 pb-16 pt-8 md:px-10 md:pt-10">{children}</div>
      </main>
    </div>
  );
}
