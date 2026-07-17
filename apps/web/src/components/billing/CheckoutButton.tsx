"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Currency } from "@/lib/plans";
import { useOnRamp } from "@onramp-sdk/react";

export function CheckoutButton({
  planId,
  currency,
  label,
  className,
}: {
  planId: "PRO" | "BUSINESS";
  currency: Currency;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const { step } = useOnRamp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    step("upgrade_clicked", { properties: { plan: planId, currency } });
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, currency }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={start} disabled={loading} className={className}>
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
