"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useIconHover } from "@/components/icons/animated";
import { ChevronsUpDownIcon } from "@/components/icons/chevrons-up-down";

export type Account = { handle: string; name: string | null; email: string | null; image: string | null; publicHref: string };

const menuItem =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] text-fg-2 outline-none hover:bg-ink/[0.05] hover:text-fg focus-visible:bg-ink/[0.05] focus-visible:text-fg";

function Avatar({ account }: { account: Account }) {
  if (account.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={account.image} alt="" width={24} height={24} className="size-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-medium uppercase text-page">
      {account.handle[0]}
    </span>
  );
}

/** Avatar + handle. Opens a small menu above it: public page and sign out. */
export function AccountMenu({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { ref, hover } = useIconHover();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative min-w-0 flex-1">
      {open ? (
        <div id={menuId} className="surface absolute bottom-full left-0 z-10 mb-2 w-60 rounded-xl p-1.5">
          <div className="border-b border-line px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[14px] font-medium text-fg">{account.name ?? `@${account.handle}`}</p>
            {account.email ? <p className="truncate text-[13px] text-fg-3">{account.email}</p> : null}
          </div>
          <div className="pt-1.5">
            <a href={account.publicHref} target="_blank" rel="noreferrer" className={menuItem} onClick={() => setOpen(false)}>
              <ExternalLink aria-hidden size={16} strokeWidth={1.6} />
              View public page
            </a>
            <form action="/sign-out" method="post">
              <button type="submit" className={menuItem}>
                <LogOut aria-hidden size={16} strokeWidth={1.6} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for @${account.handle}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left text-[14px] text-fg outline-none transition-colors hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-ink/60"
        {...hover}
      >
        <Avatar account={account} />
        <span className="min-w-0 flex-1 truncate">@{account.handle}</span>
        <ChevronsUpDownIcon ref={ref} size={14} className="shrink-0 text-fg-3" />
      </button>
    </div>
  );
}
