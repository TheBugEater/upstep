"use client";

import { useEffect } from "react";
import { UpstepProvider, FeedbackWidget, useUpstep } from "@upstep/js/react";

const apiKey = process.env.NEXT_PUBLIC_UPSTEP_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_UPSTEP_BASE_URL;
const OPEN_EVENT = "upstep:open-feedback";

/** Whether Upstep's own feedback widget is configured for this deployment. */
export const feedbackWidgetEnabled = Boolean(apiKey && apiKey !== "undefined" && baseUrl && baseUrl !== "undefined");

/** Opens the dashboard's feedback widget from anywhere (e.g. the sidebar). */
export function openFeedbackWidget() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function OpenListener() {
  const { open } = useUpstep();
  useEffect(() => {
    const handler = () => open();
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [open]);
  return null;
}

/** The floating launcher sat over the dashboard's own send buttons, so the
 *  dashboard opens the widget from the sidebar instead. */
export function UpstepWidget({ userId }: { userId?: string }) {
  if (!feedbackWidgetEnabled) return null;
  return (
    <UpstepProvider
      apiKey={apiKey!}
      baseUrl={baseUrl!}
      accentColor="rgb(var(--c-clay))"
      {...(userId ? { userId } : {})}
    >
      <OpenListener />
      <FeedbackWidget hideLauncher />
    </UpstepProvider>
  );
}
