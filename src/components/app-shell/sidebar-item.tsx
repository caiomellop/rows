"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useIconHover, type AnimatedIcon } from "@/components/icons/animated";
import { isActive } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

const base =
  "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/60";
const idle = "text-fg-2 hover:bg-ink/[0.05] hover:text-fg";
const current = "bg-ink/[0.08] font-medium text-fg";

export const ICON_SIZE = 17;

/** Thin line icon, as in the rest of the sidebar. */
const iconClass = "shrink-0 [&_svg]:[stroke-width:1.6]";

type Common = { icon: AnimatedIcon; children: ReactNode; trailing?: ReactNode };

/** A sidebar link. Highlights itself (and sets aria-current) on its own page. */
export function SidebarLink({ href, external, icon: Icon, children, trailing }: Common & { href: string; external?: boolean }) {
  const pathname = usePathname();
  const { ref, hover } = useIconHover();
  const active = !external && isActive(pathname, href);
  const body = (
    <>
      <Icon ref={ref} size={ICON_SIZE} className={iconClass} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cn(base, idle)} {...hover}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(base, active ? current : idle)} {...hover}>
      {body}
    </Link>
  );
}

/** A sidebar item that runs an action (inside a <form>) instead of navigating. */
export function SidebarButton({ icon: Icon, children, trailing }: Common) {
  const { ref, hover } = useIconHover();
  return (
    <button type="submit" className={cn(base, idle)} {...hover}>
      <Icon ref={ref} size={ICON_SIZE} className={iconClass} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

/** A page that does not exist yet: shown, but not reachable. */
export function SidebarSoon({ icon: Icon, children }: Omit<Common, "trailing">) {
  return (
    <span aria-disabled className={cn(base, "cursor-default text-fg-3")}>
      <Icon size={ICON_SIZE} className={iconClass} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="rounded-full border border-line px-1.5 py-px text-[11px] text-fg-3">Soon</span>
    </span>
  );
}

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      {label ? <p className="px-2.5 pb-1 pt-0.5 text-[12px] font-medium text-fg-3">{label}</p> : null}
      {children}
    </div>
  );
}

export function SidebarDivider() {
  return <hr className="my-3 border-line" />;
}
