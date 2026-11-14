/**
 * The Rows symbol: concentric arcs. Drawn with `currentColor`, so it is black
 * on the light theme and white on the dark one.
 *
 * PLACEHOLDER: this is a hand-drawn approximation. Replace the paths with the
 * ones from public/brand/rows-mark.svg once the "rows-logo" pack is in the repo.
 */
export function RowsMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className={className}
    >
      <path d="M3 20a17 17 0 0 1 17-17" />
      <path d="M9 20A11 11 0 0 1 20 9" />
      <path d="M15 20a5 5 0 0 1 5-5" />
    </svg>
  );
}
