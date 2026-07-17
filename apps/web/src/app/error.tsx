"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Logo />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-mono text-xs text-clay font-medium tracking-widest uppercase mb-4">500</p>
          <h1 className="font-serif text-4xl tracking-tight text-ink mb-3">Something went wrong</h1>
          <p className="text-muted text-sm leading-relaxed mb-8">
            An unexpected error occurred. If this keeps happening, please get in touch.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-card border border-line text-ink rounded-full px-5 py-2.5 text-sm font-medium hover:bg-surface transition"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
