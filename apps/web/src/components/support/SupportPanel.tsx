"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SupportSetup, type SupportSetupConfig } from "./SupportSetup";
import { SupportConnectors } from "./SupportConnectors";
import { SupportInbox, type InboxConversation } from "./SupportInbox";
import { SupportKnowledge } from "./SupportKnowledge";
import { SupportIcon } from "./SupportIcons";
import type { TeamMember } from "../workspace/ProjectWorkspace";

type Config = SupportSetupConfig & {
  crawledAt?: string | null;
  businessProfile?: {
    facts?: { label: string; value: string }[];
    answers?: { question: string; answer: string }[];
  } | null;
};
type Summary = {
  paid: boolean;
  config: Config | null;
  conversations: InboxConversation[];
  available: boolean;
  online: { userId: string; user: { name: string | null } }[];
  pages: { url: string; title: string; indexedAt?: string }[];
  usage: { used: number; limit: number };
  gaps?: { id: string; conversationId: string; summary: string; createdAt: string }[];
  connectors?: { name: string; enabled: boolean }[];
  ai: { ready: boolean };
  canManage: boolean;
  limits: { pages: number };
};
type View = "inbox" | "knowledge" | "connectors" | "settings";

export function SupportPanel({
  projectId,
  apiKey,
  baseUrl,
  teamMembers,
  currentUserId,
  isOwner,
}: {
  projectId: string;
  apiKey: string;
  baseUrl: string;
  teamMembers: TeamMember[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const params = useSearchParams();
  const [data, setData] = useState<Summary | null>(null);
  const [view, setView] = useState<View>(params.get("setup") === "1" ? "settings" : "inbox");
  const [selected, setSelected] = useState<string | null>(params.get("conversation"));
  const initialized = useRef(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/projects/${projectId}/support`;

  const request = useCallback(async (url: string, method = "GET", body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not complete the request.");
    return json;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const result = (await request(endpoint)) as Summary;
      setData(result);
      if (!initialized.current) {
        initialized.current = true;
        setAvailable(result.available || false);
        if (result.paid && (!result.config || result.config.learningState !== "READY"))
          setView("settings");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [endpoint, request]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!data?.paid || !available) return;
    const beat = () =>
      request(endpoint, "POST", { action: "presence", available: true }).catch(() => {});
    void beat();
    const t = setInterval(beat, 25_000);
    return () => clearInterval(t);
  }, [available, data?.paid, endpoint, request]);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return <div className="py-12 text-sm text-muted">{error || "Loading support…"}</div>;
  if (!data.paid)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-8">
        <span className="text-xs font-semibold text-clay">UPSTEP SUPPORT</span>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Support that starts a conversation.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          AI answers from your website and your own data, a shared team inbox, live chat and
          private support tickets. Available on Pro and Business.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-block rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-raised"
        >
          Explore paid plans →
        </Link>
      </div>
    );

  const waiting = data.conversations.filter((c) => c.state === "WAITING").length;
  const tabs: { id: View; label: string; badge?: number }[] = [
    { id: "inbox", label: "Inbox", ...(waiting ? { badge: waiting } : {}) },
    { id: "knowledge", label: "Knowledge" },
    ...(data.canManage
      ? ([
          { id: "connectors", label: "Connectors" },
          { id: "settings", label: "Settings" },
        ] as const)
      : []),
  ];
  const usagePct = Math.min(100, Math.round((data.usage.used / Math.max(1, data.usage.limit)) * 100));

  return (
    // The inbox works like an app view on desktop: the page stays put and the
    // conversation list and thread scroll on their own.
    <div className={`mx-auto max-w-[1480px] ${view === "inbox" ? "lg:flex lg:h-[calc(100dvh-48px)] lg:flex-col" : ""}`}>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-60">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Customer support</h1>
          <p className="mt-0.5 text-xs text-muted">One conversation, from the first question to the fix.</p>
        </div>
        <div className="flex min-w-[150px] flex-col gap-1" title={`${data.usage.used} of ${data.usage.limit} AI replies used this month`}>
          <span className="text-[11px] text-faint">
            {data.usage.used.toLocaleString()} of {data.usage.limit.toLocaleString()} AI replies
          </span>
          <span className="block h-1 rounded-full bg-raised">
            <span
              className={`block h-1 rounded-full ${usagePct > 90 ? "bg-warning" : "bg-ink"}`}
              style={{ width: `${usagePct}%` }}
            />
          </span>
        </div>
        <button
          aria-pressed={available}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-raised disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await request(endpoint, "POST", { action: "presence", available: !available });
              setAvailable(!available);
            })
          }
        >
          <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-faint"}`} />
          {available ? "Available" : "Away"}
        </button>
      </div>

      <nav aria-label="Support sections" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setView(t.id);
              setError("");
              setNotice("");
            }}
            aria-current={view === t.id ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[13px] transition ${view === t.id ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="rounded-full bg-clay px-1.5 text-[10.5px] font-semibold leading-4 text-clay-fg">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-success/10 p-3 text-sm text-ink">
          {notice}
        </p>
      )}
      {!data.ai.ready && (
        <p className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-ink">
          AI isn&apos;t configured on this server yet. Conversations remain available for the team.
        </p>
      )}

      {view === "inbox" && (
        <SupportInbox
          projectId={projectId}
          conversations={data.conversations}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          connectors={data.connectors || []}
          aiReady={data.ai.ready}
          request={request}
          refresh={refresh}
          selected={selected}
          onSelect={setSelected}
          {...(data.canManage ? { onOpenConnectors: () => setView("connectors") } : {})}
        />
      )}
      {view === "knowledge" && (
        <SupportKnowledge
          domain={data.config?.domain || null}
          enabled={!!data.config?.enabled}
          crawlState={data.config?.crawlState || null}
          crawlError={data.config?.crawlError || null}
          crawledAt={data.config?.crawledAt || null}
          pages={data.pages}
          pageLimit={data.limits.pages}
          profile={data.config?.businessProfile || null}
          gaps={data.gaps || []}
          connectors={data.connectors || []}
          canManage={data.canManage}
          busy={busy}
          onRefresh={() =>
            void run(() => request(endpoint, "POST", { action: "crawl" }), "Website refresh queued.")
          }
          onOpenConversation={(id) => {
            setSelected(id);
            setView("inbox");
          }}
          onOpenConnectors={() => setView("connectors")}
          onOpenSettings={() => setView("settings")}
        />
      )}
      {view === "connectors" && data.canManage && <SupportConnectors projectId={projectId} />}
      {view === "settings" && data.canManage && (
        <SupportSetup
          projectId={projectId}
          apiKey={apiKey}
          baseUrl={baseUrl}
          config={data.config}
          pageCount={data.pages.length}
          isOwner={isOwner}
          onSaved={refresh}
        />
      )}
      {view === "inbox" && !data.conversations.length && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <SupportIcon name="message" className="h-3.5 w-3.5" />
          Install the chat widget from Settings to start receiving conversations.
        </p>
      )}
    </div>
  );
}
