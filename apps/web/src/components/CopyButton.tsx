"use client";

import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs px-2.5 py-1.5 rounded-lg bg-clay-tint text-clay hover:bg-clay-tint2 transition font-medium inline-flex items-center gap-1.5"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}
