import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Logo />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-mono text-xs text-clay font-medium tracking-widest uppercase mb-4">404</p>
          <h1 className="font-serif text-4xl tracking-tight text-ink mb-3">Page not found</h1>
          <p className="text-muted text-sm leading-relaxed mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition"
            >
              ← Go home
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-card border border-line text-ink rounded-full px-5 py-2.5 text-sm font-medium hover:bg-surface transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
