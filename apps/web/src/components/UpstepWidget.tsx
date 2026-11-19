"use client";

import { useEffect, useState } from "react";
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
  const [identity, setIdentity] = useState<{ userId: string; token: string }>();
  useEffect(() => {
    if (!feedbackWidgetEnabled || !userId) { setIdentity(undefined); return; }
    const controller = new AbortController();
    let refreshAfter = 0;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || Date.now() < refreshAfter) return;
      refreshing = true;
      try {
        const response = await fetch("/api/support/identity", { cache: "no-store", signal: controller.signal });
        if (!response.ok) { if (!controller.signal.aborted) setIdentity(undefined); return; }
        const data = await response.json();
        if (!controller.signal.aborted && typeof data.token === "string") {
          setIdentity({ userId, token: data.token });
          refreshAfter = Date.now() + 8 * 60_000;
        }
      } catch { if (!controller.signal.aborted) setIdentity(undefined); }
      finally { refreshing = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [userId]);
  if (!feedbackWidgetEnabled) return null;
  return (
    <UpstepProvider
      apiKey={apiKey!}
      baseUrl={baseUrl!}
      accentColor="rgb(var(--c-clay))"
      {...(userId ? { userId } : {})}
      {...(identity?.userId === userId && identity ? { supportIdentityToken: identity.token } : {})}
    >
      <OpenListener />
      <FeedbackWidget hideLauncher />
    </UpstepProvider>
  );
}
