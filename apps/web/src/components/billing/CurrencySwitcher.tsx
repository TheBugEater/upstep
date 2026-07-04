"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CURRENCIES, CURRENCY_META, type Currency } from "@/lib/plans";

const COOKIE = "upstep_currency";

export function CurrencySwitcher({ current }: { current: Currency }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(c: Currency) {
    if (c === current) return;
    document.cookie = `${COOKIE}=${c}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-card p-1 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {CURRENCIES.map((c) => (
        <button
          key={c}
          onClick={() => select(c)}
          aria-pressed={c === current}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
            c === current ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
          }`}
        >
          {CURRENCY_META[c].symbol} {c}
        </button>
      ))}
    </div>
  );
}
