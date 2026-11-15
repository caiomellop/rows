/**
 * The Prepermint symbol: a "P". Drawn with `currentColor`, so it is black on
 * the light theme and white on the dark one.
 *
 * PLACEHOLDER: this is a provisional drawing. Replace the paths with the final
 * logo once it exists (identity and logo are outside MVP-50).
 */
export function PrepermintMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 21V3h6.5a5.25 5.25 0 0 1 0 10.5H7" />
    </svg>
  );
}
