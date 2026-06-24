"use client";

import { useTrackStep } from "@onramp-sdk/react";

export function UpgradeSuccessBanner({ plan }: { plan: string }) {
  useTrackStep("upgrade_completed", { properties: { plan } });
  return (
    <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
      <span className="font-medium">{plan}</span> is now active. Welcome aboard.
    </div>
  );
}
