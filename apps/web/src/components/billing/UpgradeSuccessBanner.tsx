"use client";

import { useTrackStep } from "@onramp-sdk/react";

export function UpgradeSuccessBanner({ plan }: { plan: string }) {
  useTrackStep("upgrade_completed", { properties: { plan } });
  return (
    <div className="mt-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
      <span className="font-medium">{plan}</span> is now active. Welcome aboard.
    </div>
  );
}
