import Link from "next/link";

/** Dark rounded mark (a provisional "P") + Geist wordmark. Spec §4. */
export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Prepermint home"
      className="flex items-center gap-[7px] text-fg"
    >
      <span className="grid size-[26px] place-items-center rounded-[7px] bg-ink">
        <svg aria-hidden viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 21V3h6.5a5.25 5.25 0 0 1 0 10.5H7" />
        </svg>
      </span>
      <span className="font-geist text-[22px] font-semibold leading-none tracking-[-0.04em]">
        Prepermint
      </span>
    </Link>
  );
}
