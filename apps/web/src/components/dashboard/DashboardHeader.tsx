"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export function DashboardHeader({ email }: { email: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const initial = (email?.[0] ?? "U").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Logo href="/dashboard" />

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-surface transition"
          >
            <span className="w-7 h-7 rounded-full bg-clay text-white text-xs font-semibold flex items-center justify-center">
              {initial}
            </span>
            <span className="text-sm text-muted hidden sm:block max-w-[180px] truncate">{email}</span>
            <span className="text-faint text-xs">▾</span>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-line bg-card shadow-lift p-1.5 z-20">
                <div className="px-3 py-2 border-b border-line mb-1">
                  <p className="text-xs text-faint">Signed in as</p>
                  <p className="text-sm text-ink truncate">{email}</p>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-ink-soft hover:bg-surface rounded-lg px-3 py-2 transition"
                >
                  Projects
                </Link>
                <Link
                  href="/dashboard/billing"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-ink-soft hover:bg-surface rounded-lg px-3 py-2 transition"
                >
                  Billing &amp; plan
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left text-sm text-ink-soft hover:bg-surface rounded-lg px-3 py-2 transition mt-1 border-t border-line pt-2"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
