export function PageSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-ink/10" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-ink/[0.07]" />
      <div className="surface h-40 animate-pulse" />
      <div className="surface h-40 animate-pulse" />
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[2.2rem] leading-[1.1] text-fg">{title}</h1>
      {children ? <div className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-fg-2">{children}</div> : null}
    </div>
  );
}
