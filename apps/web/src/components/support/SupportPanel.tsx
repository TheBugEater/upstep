"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TeamMember } from "../workspace/ProjectWorkspace";

type Message = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  createdAt: string;
  metadata?: { citations?: { url: string; title: string }[] };
};
type Config = {
  enabled: boolean;
  domain: string;
  businessName: string;
  mode: string;
  welcomeMessage: string;
  crawlState?: string;
  crawlError?: string;
  crawledAt?: string;
};
type Conversation = {
  id: string;
  state: string;
  assignedToId: string | null;
  ticketId: string | null;
  aiPending: boolean;
  customer: { name: string | null; email: string | null; verified: boolean };
  messages: Message[];
  updatedAt: string;
};
type Summary = {
  paid: boolean;
  config: Config | null;
  conversations: Conversation[];
  available: boolean;
  online: { userId: string; user: { name: string | null } }[];
  pages: { url: string; title: string }[];
  usage: { used: number; limit: number };
  ai: { ready: boolean };
  canManage: boolean;
  limits: { pages: number };
};
const button =
  "rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface disabled:opacity-50";
const field =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-clay";
const stateLabel: Record<string, string> = {
  AI: "AI assistant",
  WAITING: "Needs a teammate",
  HUMAN: "With team",
  RESOLVED: "Resolved",
};
const stateColor: Record<string, string> = {
  AI: "bg-indigo-500",
  WAITING: "bg-amber-500",
  HUMAN: "bg-emerald-500",
  RESOLVED: "bg-neutral-400",
};
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
  const [view, setView] = useState("inbox");
  const [draft, setDraft] = useState<Config>({
    enabled: true,
    domain: "",
    businessName: "",
    mode: "AI_FIRST",
    welcomeMessage: "Hi! How can we help you today?",
  });
  const initialized = useRef(false);
  const pendingReply = useRef<{
    id: string;
    content: string;
    note: boolean;
    conversationId: string | null;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(
    params.get("conversation"),
  );
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState("OPEN");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/projects/${projectId}/support`;
  const request = useCallback(
    async (url: string, method = "GET", body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Could not complete the request.");
      return json;
    },
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const result = (await request(endpoint)) as Summary;
      setData(result);
      if (!initialized.current) {
        initialized.current = true;
        setAvailable(result.available || false);
        if (result.config) setDraft(result.config);
        else if (result.paid) setView("settings");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [endpoint, request]);
  const refreshConversation = useCallback(async () => {
    if (!selected) {
      setConversation(null);
      return;
    }
    try {
      const value = await request(`${endpoint}/conversations/${selected}`);
      if (selectedRef.current === selected) setConversation(value);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [endpoint, selected, request]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    setConversation(null);
    void refreshConversation();
    const t = setInterval(() => {
      if (!document.hidden) void refreshConversation();
    }, 2500);
    return () => clearInterval(t);
  }, [refreshConversation]);
  useEffect(() => {
    if (!data?.paid || !available) return;
    const beat = () =>
      request(endpoint, "POST", { action: "presence", available: true }).catch(
        () => {},
      );
    void beat();
    const t = setInterval(beat, 25_000);
    return () => clearInterval(t);
  }, [available, data?.paid, endpoint, request]);
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await Promise.all([refresh(), refreshConversation()]);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string, extra = {}) {
    return mutate(() =>
      request(`${endpoint}/conversations/${selected}`, "POST", {
        action,
        ...extra,
      }),
    );
  }
  const visible = (data?.conversations || []).filter((c) =>
    filter === "ALL" || filter === "MINE"
      ? filter === "ALL" || c.assignedToId === currentUserId
      : filter === "OPEN"
        ? c.state !== "RESOLVED"
        : c.state === filter,
  );
  if (!data)
    return (
      <div className="py-12 text-sm text-muted">
        {error || "Loading support…"}
      </div>
    );
  if (!data.paid)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-8">
        <span className="text-xs font-semibold text-clay">UPSTEP SUPPORT</span>
        <h1 className="mt-3 text-2xl font-semibold text-ink">
          Support that starts a conversation.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          AI answers from your website, a shared team inbox, live chat and
          private support tickets. Available on Pro and Business.
        </p>
        <Link
          href="/dashboard/billing"
          className={`${button} mt-6 inline-block`}
        >
          Explore paid plans →
        </Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Customer support</h1>
          <p className="mt-1 text-xs text-muted">
            One conversation, from the first question to the fix.
          </p>
        </div>
        <button
          className={button}
          onClick={() =>
            void mutate(async () => {
              await request(endpoint, "POST", {
                action: "presence",
                available: !available,
              });
              setAvailable(!available);
            })
          }
        >
          <span
            className={`mr-2 inline-block h-2 w-2 rounded-full ${available ? "bg-emerald-500" : "bg-neutral-400"}`}
          />
          {available ? "You're available" : "You're away"}
        </button>
      </div>
      <div className="mb-5 flex gap-1 border-b border-line">
        {["inbox", "knowledge", ...(data.canManage ? ["settings"] : [])].map(
          (v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`border-b-2 px-4 pb-3 text-xs font-semibold capitalize ${view === v ? "border-clay text-ink" : "border-transparent text-muted"}`}
            >
              {v}
            </button>
          ),
        )}
        <span className="ml-auto py-2 text-xs text-faint">
          {data.usage.used} / {data.usage.limit} AI replies this month
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-success/10 p-3 text-sm text-ink"
        >
          {notice}
        </p>
      )}
      {!data.ai.ready && (
        <p className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-ink">
          AI isn't configured on this server yet. Conversations remain available
          for the team.
        </p>
      )}
      {view === "inbox" && (
        <div className="grid min-h-[580px] overflow-hidden rounded-2xl border border-line bg-card md:grid-cols-[290px_1fr]">
          <aside className="border-b border-line md:border-b-0 md:border-r">
            <div className="p-3">
              <select
                aria-label="Filter conversations"
                className={field}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  ["OPEN", "Open conversations"],
                  ["WAITING", "Needs a teammate"],
                  ["MINE", "Assigned to me"],
                  ["RESOLVED", "Resolved"],
                  ["ALL", "All conversations"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {visible.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full border-t border-line p-4 text-left transition hover:bg-surface ${selected === c.id ? "bg-surface" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${stateColor[c.state]}`}
                    />
                    <strong className="truncate text-xs text-ink">
                      {c.customer.name || c.customer.email || "Visitor"}
                    </strong>
                    <span className="ml-auto text-[10px] text-faint">
                      {new Date(c.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted">
                    {c.messages[0]?.content || "New conversation"}
                  </p>
                  <p className="mt-2 text-[10px] text-faint">
                    {stateLabel[c.state]}
                  </p>
                </button>
              ))}
              {!visible.length && (
                <p className="p-8 text-center text-xs leading-6 text-muted">
                  Your next customer conversation will appear here.
                </p>
              )}
            </div>
          </aside>
          {conversation ? (
            <section className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    {conversation.customer.name || "Visitor"}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {conversation.customer.email || "No email shared"}
                    {conversation.customer.verified
                      ? " · Verified account"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() => void act("takeover")}
                  >
                    Take over
                  </button>
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() => void act("ai")}
                  >
                    Let AI reply
                  </button>
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() => void act("resolve")}
                  >
                    Resolve
                  </button>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3">
                  <select
                    aria-label="Assign conversation"
                    className="rounded-lg border border-line bg-card p-1.5 text-xs text-ink"
                    value={conversation.assignedToId || ""}
                    onChange={(e) =>
                      void act("assign", { assigneeId: e.target.value || null })
                    }
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">
                    {stateLabel[conversation.state]}
                  </span>
                  {conversation.ticketId ? (
                    <Link
                      className="ml-auto text-xs font-semibold text-clay"
                      href={`/dashboard/projects/${projectId}?issue=${conversation.ticketId}`}
                    >
                      Open ticket ↗
                    </Link>
                  ) : (
                    <button
                      disabled={busy}
                      className="ml-auto text-xs font-semibold text-clay"
                      onClick={() => void act("ticket")}
                    >
                      Create private ticket
                    </button>
                  )}
                </div>
              </div>
              <div className="flex max-h-[460px] min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto p-5">
                {conversation.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`${m.role === "CUSTOMER" ? "mr-8" : "ml-8"} rounded-xl p-3 ${m.role === "NOTE" ? "border border-warning/30 bg-warning/10" : m.role === "SYSTEM" ? "bg-transparent" : "bg-surface"}`}
                  >
                    <div className="mb-1 flex gap-2 text-[10px] text-muted">
                      <strong>{m.authorName}</strong>
                      {m.role === "NOTE" && <span>Private note</span>}
                      <span className="ml-auto">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">
                      {m.content}
                    </p>
                    {m.metadata?.citations?.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-xs text-clay"
                      >
                        ↗ {s.title}
                      </a>
                    ))}
                  </div>
                ))}
                {conversation.aiPending && (
                  <p className="text-xs text-muted">AI is composing a reply…</p>
                )}
              </div>
              <form
                className="mt-auto border-t border-line p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!message.trim()) return;
                  if (
                    !pendingReply.current ||
                    pendingReply.current.content !== message ||
                    pendingReply.current.note !== note ||
                    pendingReply.current.conversationId !== selected
                  )
                    pendingReply.current = {
                      id: crypto.randomUUID(),
                      content: message,
                      note,
                      conversationId: selected,
                    };
                  void act(note ? "note" : "reply", {
                    content: message,
                    clientMessageId: pendingReply.current.id,
                  }).then((ok) => {
                    if (ok) {
                      setMessage("");
                      pendingReply.current = null;
                    }
                  });
                }}
              >
                <textarea
                  aria-label={note ? "Private note" : "Reply to customer"}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder={
                    note
                      ? "Only your team can see this note…"
                      : "Reply as yourself…"
                  }
                  className={field}
                />
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={note}
                      onChange={(e) => setNote(e.target.checked)}
                    />
                    Private note
                  </label>
                  <button
                    disabled={busy || !message.trim()}
                    className={`${button} bg-primary text-primary-fg`}
                  >
                    {note ? "Add note" : "Send reply"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <div className="grid min-h-[380px] place-items-center p-8 text-center">
              <div>
                <span className="text-3xl text-faint">◌</span>
                <h2 className="mt-3 text-sm font-semibold text-ink">
                  A little help goes a long way.
                </h2>
                <p className="mt-2 text-xs text-muted">
                  Select a conversation to reply or let AI handle the first
                  question.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {view === "knowledge" && (
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Business knowledge
              </h2>
              <p className="mt-2 text-xs text-muted">
                {data.config?.domain || "Add your domain in settings"} ·{" "}
                {data.pages.length} / {data.limits.pages} pages ·{" "}
                {data.config?.crawlState?.toLowerCase() || "Not started"}
              </p>
            </div>
            {data.canManage && (
              <button
                disabled={busy || !data.config?.enabled}
                className={button}
                onClick={() =>
                  void mutate(() =>
                    request(endpoint, "POST", { action: "crawl" }),
                  ).then((ok) => {
                    if (ok) setNotice("Website refresh queued.");
                  })
                }
              >
                Refresh website
              </button>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-6 text-muted">
            AI searches these public pages before answering. Pages refresh
            weekly. Login pages, dashboards and private customer data are
            excluded. Sites that require JavaScript may need public
            documentation pages.
          </p>
          {data.config?.crawlError && (
            <p className="mt-3 text-xs text-warning">
              {data.config.crawlError}
            </p>
          )}
          <div className="mt-6 divide-y divide-line">
            {data.pages.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3"
              >
                <p className="text-sm text-ink">{p.title}</p>
                <p className="mt-1 truncate text-xs text-muted">{p.url}</p>
              </a>
            ))}
            {!data.pages.length && (
              <p className="py-8 text-sm text-muted">
                No pages indexed yet. Add your business domain to get started.
              </p>
            )}
          </div>
        </div>
      )}
      {view === "settings" && data.canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            className="rounded-2xl border border-line bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(() => request(endpoint, "PUT", draft)).then((ok) => {
                if (ok)
                  setNotice(
                    "Support saved. Your public website will be indexed automatically.",
                  );
              });
            }}
          >
            <h2 className="text-base font-semibold text-ink">
              Start with your website.
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              We'll find your public pages and use them to answer customer
              questions.
            </p>
            <div className="mt-5 space-y-4">
              <label className="block text-xs text-muted">
                Business domain
                <input
                  required
                  placeholder="yourbusiness.com"
                  value={draft.domain}
                  onChange={(e) =>
                    setDraft({ ...draft, domain: e.target.value })
                  }
                  className={`${field} mt-2`}
                />
              </label>
              <label className="block text-xs text-muted">
                Business name (optional)
                <input
                  maxLength={80}
                  placeholder="Detected from your website"
                  value={draft.businessName}
                  onChange={(e) =>
                    setDraft({ ...draft, businessName: e.target.value })
                  }
                  className={`${field} mt-2`}
                />
              </label>
              <label className="block text-xs text-muted">
                Who replies first?
                <select
                  className={`${field} mt-2`}
                  value={draft.mode}
                  onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
                >
                  <option value="AI_FIRST">AI first, with human handoff</option>
                  <option value="HUMAN_FIRST">
                    Team when available, otherwise AI
                  </option>
                  <option value="HUMAN_ONLY">Team only</option>
                </select>
              </label>
              <label className="block text-xs text-muted">
                Welcome message
                <textarea
                  required
                  maxLength={500}
                  value={draft.welcomeMessage}
                  onChange={(e) =>
                    setDraft({ ...draft, welcomeMessage: e.target.value })
                  }
                  className={`${field} mt-2`}
                  rows={3}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, enabled: e.target.checked })
                  }
                />
                Enable customer support
              </label>
            </div>
            <button
              disabled={busy}
              className={`${button} mt-6 bg-primary text-primary-fg`}
            >
              {busy ? "Saving…" : "Save and learn my website"}
            </button>
          </form>
          <div className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-base font-semibold text-ink">
              One embed. Ready to help.
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              Already using the latest UpStep widget? Support appears
              automatically after you enable it. For a new website, paste this
              before the closing body tag.
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-surface p-4 text-xs leading-6 text-ink">{`<script defer\n  src="${baseUrl}/sdk/upstep.js"\n  data-api-key="${apiKey}">\n</script>`}</pre>
            <button
              className={`${button} mt-3`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    `<script defer src="${baseUrl}/sdk/upstep.js" data-api-key="${apiKey}"></script>`,
                  )
                  .then(() => setNotice("Embed copied."))
              }
            >
              Copy embed
            </button>
            <p className="mt-6 text-xs leading-6 text-muted">
              Customer email is optional. Signed-in apps can pass a verified
              identity token to securely restore the customer's conversations
              across devices.
            </p>
            <Link
              className="mt-3 block text-xs font-semibold text-clay"
              href="/guides/customer-support"
            >
              Read integration guide →
            </Link>
            {isOwner && (
              <button
                className={`${button} mt-4`}
                onClick={() =>
                  void mutate(async () => {
                    const value = await request(endpoint, "POST", {
                      action: "identity",
                    });
                    await navigator.clipboard.writeText(value.secret);
                    setNotice(
                      "Identity signing secret copied. Store it only on your backend.",
                    );
                  })
                }
              >
                Copy identity signing secret
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
