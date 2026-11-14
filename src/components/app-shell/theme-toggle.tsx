"use client";

import { useIconHover } from "@/components/icons/animated";
import { MoonIcon } from "@/components/icons/moon";
import { SunIcon } from "@/components/icons/sun";

/** Must match the inline script in src/app/layout.tsx. */
export const THEME_KEY = "rows-theme";

export const footerButton =
  "grid size-9 shrink-0 place-items-center rounded-lg text-fg-2 outline-none transition-colors hover:bg-ink/[0.05] hover:text-fg focus-visible:ring-2 focus-visible:ring-ink/60";

/**
 * Light / dark switch. The theme lives in `data-theme` on <html> (set before
 * paint by the inline script) and CSS picks the icon, so there is no React
 * state to get out of sync with it.
 */
export function ThemeToggle() {
  const { ref: sunRef, hover: sunHover } = useIconHover();
  const { ref: moonRef, hover: moonHover } = useIconHover();

  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice lasts until the page is reloaded.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Theme"
      className={footerButton}
      onPointerEnter={(e) => {
        sunHover.onPointerEnter(e);
        moonHover.onPointerEnter(e);
      }}
      onPointerLeave={() => {
        sunHover.onPointerLeave();
        moonHover.onPointerLeave();
      }}
    >
      <MoonIcon ref={moonRef} size={17} className="dark:hidden [&_svg]:[stroke-width:1.6]" />
      <SunIcon ref={sunRef} size={17} className="hidden dark:block [&_svg]:[stroke-width:1.6]" />
    </button>
  );
}
