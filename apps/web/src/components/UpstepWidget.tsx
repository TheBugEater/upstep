"use client";

import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

const apiKey = process.env.NEXT_PUBLIC_UPSTEP_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_UPSTEP_BASE_URL;

export function UpstepWidget() {
  if (!apiKey || apiKey === "undefined" || !baseUrl || baseUrl === "undefined") return null;
  return (
    <UpstepProvider apiKey={apiKey} baseUrl={baseUrl}>
      <FeedbackWidget />
    </UpstepProvider>
  );
}
