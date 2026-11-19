"use client";
import { useState } from "react";
import { SupportIcon } from "./SupportIcons";

type Page = { url: string; title: string; indexedAt?: string };
type Gap = { id: string; conversationId: string; summary: string; createdAt: string };
type Profile = {
  facts?: { label: string; value: string }[];
  answers?: { question: string; answer: string }[];
} | null;

const card = "rounded-2xl border border-line bg-card";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink transition hover:bg-raised disabled:opacity-50";

function ago(value?: string | null) {
  if (!value) return "never";
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

export function SupportKnowledge({
  domain,
  enabled,
  crawlState,
  crawlError,
  crawledAt,
  pages,
  pageLimit,
  profile,
  gaps,
  connectors,
  canManage,
  busy,
  onRefresh,
  onOpenConversation,
  onOpenConnectors,
  onOpenSettings,
}: {
  domain: string | null;
  enabled: boolean;
  crawlState: string | null;
  crawlError: string | null;
  crawledAt: string | null;
  pages: Page[];
  pageLimit: number;
  profile: Profile;
  gaps: Gap[];
  connectors: { name: string; enabled: boolean }[];
  canManage: boolean;
  busy: boolean;
  onRefresh: () => void;
  onOpenConversation: (id: string) => void;
  onOpenConnectors: () => void;
  onOpenSettings: () => void;
}) {
  const [showPages, setShowPages] = useState(false);
  const [filter, setFilter] = useState("");
  const crawling = crawlState === "CRAWLING" || crawlState === "QUEUED";
  const facts = profile?.facts || [];
  const answers = (profile?.answers || []).filter((a) => a.answer?.trim());
  const live = connectors.filter((c) => c.enabled);
  const shown = pages.filter(
    (p) => !filter || `${p.title} ${p.url}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const status = crawlError
    ? { text: "Needs attention", color: "text-warning", dot: "bg-warning" }
    : crawling
      ? { text: "Reading your site…", color: "text-info", dot: "bg-info" }
      : pages.length
        ? { text: `Synced ${ago(crawledAt)}`, color: "text-success", dot: "bg-success" }
        : { text: "Not started", color: "text-faint", dot: "bg-faint" };

  const stats = [
    { label: "Website pages", value: `${pages.length}`, sub: `of ${pageLimit} on your plan` },
    { label: "Confirmed facts & answers", value: `${facts.length + answers.length}`, sub: "the AI trusts these first" },
    {
      label: "Couldn’t resolve",
      value: `${gaps.length}`,
      sub: "questions in the last 30 days",
      tone: gaps.length ? "text-warning" : "",
    },
    { label: "Live connectors", value: `${live.length}`, sub: live.length ? live.map((c) => c.name).join(", ") : "none yet" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="text-base font-semibold text-ink">Knowledge</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Everything the AI may read before answering. Login pages, dashboards and private
            customer data are never crawled.
          </p>
        </div>
        {canManage && (
          <button onClick={onOpenSettings} className={ghost}>
            Edit facts & answers
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-xs text-faint">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-semibold tracking-tight text-ink ${s.tone || ""}`}>{s.value}</p>
            <p className="mt-1 truncate text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Sources" className={`${card} overflow-hidden`}>
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Sources</h3>

          <div className="border-b border-line px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-4 w-4">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{domain || "Your website"}</p>
                <p className="text-xs text-faint">Website · refreshed weekly · {pages.length} pages</p>
              </div>
              <span className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.text}
              </span>
              {canManage && (
                <button disabled={busy || !enabled || crawling} onClick={onRefresh} className={ghost}>
                  {crawling ? "Refreshing…" : "Refresh now"}
                </button>
              )}
            </div>
            {crawlError && <p className="mt-2 text-xs text-warning">{crawlError}</p>}
            {!enabled && <p className="mt-2 text-xs text-muted">Turn support on in Settings to start reading your site.</p>}
            {pages.length > 0 && (
              <button
                onClick={() => setShowPages((v) => !v)}
                aria-expanded={showPages}
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
              >
                <SupportIcon name="chevron" className={`h-3.5 w-3.5 transition ${showPages ? "" : "-rotate-90"}`} />
                {showPages ? "Hide pages" : "Show pages"}
              </button>
            )}
            {showPages && (
              <div className="mt-2.5 overflow-hidden rounded-xl border border-line">
                <label className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
                  <span className="sr-only">Filter pages</span>
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter pages"
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint"
                  />
                  <span className="text-[11px] text-faint">{shown.length}</span>
                </label>
                <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                  {shown.map((p) => (
                    <li key={p.url}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 hover:bg-raised">
                        <span className="block truncate text-xs text-ink">{p.title}</span>
                        <span className="block truncate text-[11px] text-faint">{p.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink">
              <SupportIcon name="message" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Confirmed facts & answers</p>
              <p className="text-xs text-faint">
                {facts.length} facts · {answers.length} answers · used ahead of website text
              </p>
            </div>
            {canManage && (
              <button onClick={onOpenSettings} className={ghost}>
                Edit
              </button>
            )}
          </div>

          {facts.length > 0 && (
            <div className="border-b border-line bg-surface px-4 py-3">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {facts.slice(0, 6).map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-[11px] text-faint">{f.label}</dt>
                    <dd className="truncate text-xs text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-clay-tint text-clay">
              <SupportIcon name="plug" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Live customer data</p>
              <p className="truncate text-xs text-faint">
                {live.length
                  ? `${live.map((c) => c.name).join(", ")} · read-only, signed-in customers only`
                  : "Let the AI check orders, plans or bookings from your API"}
              </p>
            </div>
            {canManage && (
              <button onClick={onOpenConnectors} className={ghost}>
                {connectors.length ? "Manage" : "Connect"}
              </button>
            )}
          </div>

        </section>

        <section aria-label="Questions the AI couldn't resolve" className={`${card} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Couldn’t resolve</h3>
            <span className="ml-auto text-xs text-faint">last 30 days</span>
          </div>
          {gaps.length ? (
            <ul className="divide-y divide-line">
              {gaps.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => onOpenConversation(g.conversationId)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-raised"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-5 text-ink">{g.summary}</span>
                      <span className="mt-0.5 block text-[11px] text-faint">{ago(g.createdAt)} · open conversation</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs leading-5 text-muted">
              Nothing yet. When the AI understands a question but can&apos;t find the answer,
              it shows up here so you know what to add.
            </p>
          )}
          {gaps.length > 0 && canManage && (
            <p className="border-t border-line bg-surface px-4 py-3 text-xs leading-5 text-muted">
              Add the missing answer in{" "}
              <button onClick={onOpenSettings} className="font-semibold text-clay">
                facts & answers
              </button>{" "}
              or on your site, then refresh.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
