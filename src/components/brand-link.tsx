import Image from "next/image";
import Link from "next/link";

const MARK = "/brand/rows-mark.png";

export function BrandMark({
  size,
  className,
  priority = false,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={MARK}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}

export function BrandLink({
  className = "flex items-center gap-2.5",
  markSize = 28,
  markClassName = "h-7 w-7 rounded-sm object-cover",
  wordmarkClassName = "font-[family-name:var(--font-geist)] text-[1.35rem] font-semibold tracking-[-0.04em] text-ink",
}: {
  className?: string;
  markSize?: number;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <Link href="/" className={className}>
      <BrandMark size={markSize} className={markClassName} priority />
      <span className={wordmarkClassName}>Rows</span>
    </Link>
  );
}
