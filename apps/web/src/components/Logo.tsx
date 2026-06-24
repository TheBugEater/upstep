import Link from "next/link";
import Image from "next/image";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Upstep"
      width={size}
      height={size}
      className="rounded-[10px] shadow-sm"
      priority
    />
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
