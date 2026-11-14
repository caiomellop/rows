"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { startStarter } from "@/app/(app)/dashboard/actions";
import { ModeSwitch } from "@/components/app-shell/mode-switch";
import {
  SidebarButton,
  SidebarDivider,
  SidebarLink,
  SidebarSection,
  SidebarSoon,
} from "@/components/app-shell/sidebar-item";
import { ThemeToggle, footerButton } from "@/components/app-shell/theme-toggle";
import { RowsMark } from "@/components/brand/rows-mark";
import { useIconHover } from "@/components/icons/animated";
import { BrainIcon } from "@/components/icons/brain";
import { CircleHelpIcon } from "@/components/icons/circle-help";
import { EarthIcon } from "@/components/icons/earth";
import { FileTextIcon } from "@/components/icons/file-text";
import { GithubIcon } from "@/components/icons/github";
import { HomeIcon } from "@/components/icons/home";
import { MenuIcon } from "@/components/icons/menu";
import { SettingsIcon } from "@/components/icons/settings";
import { SquarePenIcon } from "@/components/icons/square-pen";
import { UserIcon } from "@/components/icons/user";
import { XIcon } from "@/components/icons/x";
import { STARTERS } from "@/config/starters";
import { MODE_HOME, modeFor } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="Rows home" className="flex items-center gap-2 rounded-lg text-fg outline-none focus-visible:ring-2 focus-visible:ring-ink/60">
      <RowsMark size={26} />
      <span className="font-geist text-[20px] font-semibold leading-none tracking-[-0.04em]">Rows</span>
    </Link>
  );
}

function ChatNav({ threads }: { threads: ReactNode }) {
  return (
    <nav aria-label="Chat">
      <SidebarSection>
        <SidebarLink href="/chat" icon={SquarePenIcon}>
          New chat
        </SidebarLink>
        <SidebarLink href="/memory" icon={BrainIcon}>
          Memory
        </SidebarLink>
      </SidebarSection>
      <SidebarDivider />
      <SidebarSection label="Starters">
        {STARTERS.map((s) => (
          <form key={s.id} action={startStarter.bind(null, s.id)}>
            <SidebarButton icon={s.icon}>{s.title}</SidebarButton>
          </form>
        ))}
      </SidebarSection>
      <SidebarDivider />
      {threads}
    </nav>
  );
}

function DashboardNav({ publicPage }: { publicPage: ReactNode }) {
  return (
    <nav aria-label="Dashboard">
      <SidebarSection>
        <SidebarLink href="/dashboard" icon={HomeIcon}>
          Overview
        </SidebarLink>
      </SidebarSection>
      <SidebarDivider />
      <SidebarSection label="Your page">
        <SidebarLink href="/dashboard/profile" icon={UserIcon}>
          Profile
        </SidebarLink>
        <SidebarLink href="/dashboard/experience" icon={FileTextIcon}>
          Resume
        </SidebarLink>
        <SidebarLink href="/dashboard/projects" icon={GithubIcon}>
          Projects
        </SidebarLink>
        {publicPage}
      </SidebarSection>
      <SidebarDivider />
      <SidebarSection>
        <SidebarSoon icon={SettingsIcon}>Settings</SidebarSoon>
      </SidebarSection>
    </nav>
  );
}

/** The "Public page" item: opens the user's public profile in a new tab. */
export function PublicPageLink({ href }: { href: string }) {
  return (
    <SidebarLink href={href} external icon={EarthIcon}>
      Public page
    </SidebarLink>
  );
}

/** Shown while the public page address is loading. */
export function PublicPagePending() {
  return (
    <span className="flex h-9 items-center gap-2.5 px-2.5 text-[14px] text-fg-3">
      <EarthIcon size={17} className="[&_svg]:[stroke-width:1.6]" />
      Public page
    </span>
  );
}

function HelpButton() {
  const { ref, hover } = useIconHover();
  return (
    <span role="img" aria-label="Help (coming soon)" title="Help is coming soon" className={cn(footerButton, "cursor-default text-fg-3 hover:bg-transparent hover:text-fg-3")} {...hover}>
      <CircleHelpIcon ref={ref} size={17} className="[&_svg]:[stroke-width:1.6]" />
    </span>
  );
}

/**
 * The app sidebar. On desktop it is a fixed column; below 768px it becomes a
 * drawer opened from the top bar, where the Chat / Dashboard switch stays
 * visible. `threads`, `account` and `publicPage` are server-rendered slots.
 */
export function Sidebar({ threads, account, publicPage }: { threads: ReactNode; account: ReactNode; publicPage: ReactNode }) {
  const mode = modeFor(usePathname());
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const { ref: menuIconRef, hover: menuIconHover } = useIconHover();
  const { ref: closeIconRef, hover: closeIconHover } = useIconHover();

  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-page/90 px-3 backdrop-blur-md md:hidden">
        <button
          ref={menuButton}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
          className={footerButton}
          {...menuIconHover}
        >
          <MenuIcon ref={menuIconRef} size={19} className="[&_svg]:[stroke-width:1.6]" />
        </button>
        <Brand href={MODE_HOME[mode]} />
        <div className="ml-auto">
          <ModeSwitch />
        </div>
      </header>

      {open ? <div aria-hidden className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} /> : null}

      <aside
        id="app-sidebar"
        ref={drawer}
        aria-label="App"
        // Following a link or starting a chat closes the drawer.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button[type=submit]")) setOpen(false);
        }}
        className={cn(
          "flex w-[272px] shrink-0 flex-col border-r border-line bg-page",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl max-md:transition-[transform,visibility] max-md:duration-200 motion-reduce:transition-none",
          open ? "max-md:visible max-md:translate-x-0" : "max-md:invisible max-md:-translate-x-full",
          "md:sticky md:top-0 md:h-dvh",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
          <Brand href={MODE_HOME[mode]} />
          <div className="max-md:hidden">
            <ModeSwitch />
          </div>
          <button type="button" aria-label="Close menu" onClick={() => { setOpen(false); menuButton.current?.focus(); }} className={cn(footerButton, "md:hidden")} {...closeIconHover}>
            <XIcon ref={closeIconRef} size={18} className="[&_svg]:[stroke-width:1.6]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {mode === "chat" ? <ChatNav threads={threads} /> : <DashboardNav publicPage={publicPage} />}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-t border-line p-2">
          {account}
          <ThemeToggle />
          <HelpButton />
        </div>
      </aside>
    </>
  );
}

/** What the sidebar shows before the URL and the session are known. */
export function SidebarFallback() {
  return (
    <>
      <div className="h-14 border-b border-line md:hidden" />
      <div aria-busy className="hidden w-[272px] shrink-0 border-r border-line md:sticky md:top-0 md:block md:h-dvh">
        <div className="flex h-14 items-center px-4 text-fg">
          <RowsMark size={26} />
        </div>
        <div className="space-y-2 px-3 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-ink/[0.05]" />
          ))}
        </div>
      </div>
    </>
  );
}
