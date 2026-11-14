"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarSection } from "@/components/app-shell/sidebar-item";
import { cn } from "@/lib/utils";

export type ThreadItem = { id: string; title: string; date: string };

function Threads({ label, threads }: { label: string; threads: ThreadItem[] }) {
  const pathname = usePathname();
  if (threads.length === 0) return null;
  return (
    <SidebarSection label={label}>
      {threads.map((t) => {
        const href = `/chat/${t.id}`;
        const active = pathname === href;
        return (
          <Link
            key={t.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/60",
              active ? "bg-ink/[0.08] font-medium text-fg" : "text-fg-2 hover:bg-ink/[0.05] hover:text-fg",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="shrink-0 text-[12px] font-normal text-fg-3">{t.date}</span>
          </Link>
        );
      })}
    </SidebarSection>
  );
}

/** Pinned and recent conversations, each with its title and date. */
export function ThreadList({ pinned, recent }: { pinned: ThreadItem[]; recent: ThreadItem[] }) {
  if (pinned.length + recent.length === 0) {
    return (
      <SidebarSection label="Recents">
        <p className="px-2.5 text-[13px] leading-relaxed text-fg-3">Your conversations will show up here.</p>
      </SidebarSection>
    );
  }
  return (
    <div className="space-y-4">
      <Threads label="Pinned" threads={pinned} />
      <Threads label="Recents" threads={recent} />
    </div>
  );
}
