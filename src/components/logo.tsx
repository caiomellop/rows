import Link from "next/link";

/** Dark rounded mark (three "rows") + Geist wordmark. Spec §4. */
export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Rows home"
      className="flex items-center gap-[7px] text-fg"
    >
      <span className="grid size-[26px] place-items-center rounded-[7px] bg-ink">
        <svg aria-hidden viewBox="0 0 16 16" className="size-[15px]">
          <rect x="2" y="3" width="12" height="2.2" rx="1.1" fill="white" />
          <rect x="2" y="6.9" width="8.5" height="2.2" rx="1.1" fill="white" />
          <rect x="2" y="10.8" width="10.5" height="2.2" rx="1.1" fill="white" />
        </svg>
      </span>
      <span className="font-geist text-[22px] font-semibold leading-none tracking-[-0.04em]">
        Rows
      </span>
    </Link>
  );
}
