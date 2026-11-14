"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useIconHover, type AnimatedIcon } from "@/components/icons/animated";
import { LayoutPanelTopIcon } from "@/components/icons/layout-panel-top";
import { MessageCircleIcon } from "@/components/icons/message-circle";
import { MODE_HOME, modeFor, type AppMode } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

const MODES: { mode: AppMode; label: string; icon: AnimatedIcon }[] = [
  { mode: "chat", label: "Chat", icon: MessageCircleIcon },
  { mode: "dashboard", label: "Dashboard", icon: LayoutPanelTopIcon },
];

function ModeLink({ mode, label, icon: Icon, active }: (typeof MODES)[number] & { active: boolean }) {
  const { ref, hover } = useIconHover();
  return (
    <Link
      href={MODE_HOME[mode]}
      aria-label={label}
      title={label}
      aria-current={active ? "true" : undefined}
      className={cn(
        "grid h-7 w-9 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/60",
        active ? "bg-card text-fg shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-fg-3 hover:text-fg",
      )}
      {...hover}
    >
      <Icon ref={ref} size={16} className="[&_svg]:[stroke-width:1.7]" />
    </Link>
  );
}

/** Segmented Chat / Dashboard switch. The active mode comes from the URL. */
export function ModeSwitch() {
  const active = modeFor(usePathname());
  return (
    <nav aria-label="Mode" className="flex gap-0.5 rounded-lg bg-ink/[0.06] p-0.5">
      {MODES.map((m) => (
        <ModeLink key={m.mode} {...m} active={m.mode === active} />
      ))}
    </nav>
  );
}
