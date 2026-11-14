"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/experience", label: "Experience" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/assistant", label: "AI assistant" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
              active ? "bg-ink/[0.07] font-medium text-fg" : "text-fg-2 hover:bg-ink/[0.04] hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
