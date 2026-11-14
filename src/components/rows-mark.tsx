export function RowsMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="46"
      height="46"
      viewBox="0 0 46 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Soft organic mark — leaf/seed with spark */}
      <path
        d="M22.8 38.5c-7.4-1.8-12.6-7.6-13.2-14.8-.4-5.2 1.6-10.4 5.4-14.2 2.2 6.4 6.6 11.4 12.4 14.2-1.2 5.4-2.8 10.2-4.6 14.8Z"
        fill="currentColor"
      />
      <path
        d="M24.2 38.5c7.2-2.2 12-8.2 12.4-15.4.2-5-.1-9.8-3.6-13.6-1.4 6.8-5.2 12.4-10.6 16 0 4.4.6 8.8 1.8 13Z"
        fill="currentColor"
      />
      <path
        d="M23.2 8.2c.4 4.8-.2 9.2-2 13.2 3.2-1.6 6.8-2.2 10.4-1.6-2.6-5.2-5.4-9.2-8.4-11.6Z"
        fill="currentColor"
      />
      <path
        d="M31.5 7.2l1.35 2.85 2.95.35-2.25 2.1.7 2.9-2.75-1.55-2.75 1.55.7-2.9-2.25-2.1 2.95-.35L31.5 7.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
