import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[10px] bg-clay shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        {/* upward step / chevron motif */}
        <path
          d="M4 16.5L9.5 11L13 14.5L20 7.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 7.5H20V12.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ size = 28, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 group">
      <LogoMark size={size} />
      <span className="font-semibold text-ink tracking-tight text-[15px]">Upstep</span>
    </Link>
  );
}
