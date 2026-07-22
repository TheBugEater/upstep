"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS: [string, string][] = [
  ["Features", "/#features"],
  ["How it works", "/#how"],
  ["Pricing", "/pricing"],
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-md border-b border-line" />
      <nav className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-muted">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-ink transition">
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="!w-8 !h-8" />
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm text-muted hover:text-ink transition px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-fg rounded-full px-4 py-2 hover:bg-primary/85 transition shadow-sm"
          >
            Get started
            <span aria-hidden className="opacity-70">→</span>
          </Link>

          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-ink hover:bg-surface transition text-lg"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 md:hidden bg-canvas border-b border-line px-4 pb-4 pt-2 space-y-0.5">
            {NAV_LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-surface transition"
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 mt-1 border-t border-line flex gap-2">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm text-muted border border-line rounded-xl px-4 py-2.5 hover:bg-surface transition"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-medium bg-primary text-primary-fg rounded-xl px-4 py-2.5 hover:bg-primary/85 transition"
              >
                Get started
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
