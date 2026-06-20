import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Nav() {
  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-md border-b border-line" />
      <nav className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />

        <div className="hidden md:flex items-center gap-8 text-sm text-muted">
          <Link href="/#features" className="hover:text-ink transition">Features</Link>
          <Link href="/#how" className="hover:text-ink transition">How it works</Link>
          <Link href="/#integrate" className="hover:text-ink transition">Developers</Link>
          <Link href="/pricing" className="hover:text-ink transition">Pricing</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm text-muted hover:text-ink transition px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-ink text-white rounded-full px-4 py-2 hover:bg-ink-soft transition shadow-sm"
          >
            Get started
            <span aria-hidden className="text-white/70">→</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
