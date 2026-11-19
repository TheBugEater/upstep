"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TeamMember } from "../workspace/ProjectWorkspace";
import { Avatar } from "@/components/Avatar";
import { SupportIcon } from "./SupportIcons";
import { SupportSelect, type SelectOption } from "./SupportSelect";

export type InboxMessage = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  createdAt: string;
  metadata?: {
    citations?: { url: string; title: string }[];
    lookups?: {
      connector: string;
      action: string;
      ok: boolean;
      status: number | null;
      ms: number;
    }[];
  } | null;
};
export type InboxConversation = {
  id: string;
  customerId: string;
  state: string;
  assignedToId: string | null;
  ticketId: string | null;
  ticketReference?: string | null;
  ticketError?: string | null;
  aiPending: boolean;
  aiError?: string | null;
  humanRequested?: boolean;
  customer: { name: string | null; email: string | null; verified: boolean };
  messages: InboxMessage[];
  createdAt: string;
  updatedAt: string;
};
type Request = (url: string, method?: string, body?: unknown) => Promise<any>;
type ViewId = "OPEN" | "WAITING" | "MINE" | "AI" | "RESOLVED" | "ALL";

export const STATES: Record<string, { label: string; dot: string; pill: string }> = {
  AI: { label: "AI handling", dot: "bg-info", pill: "bg-info/10 text-info" },
  WAITING: { label: "Needs a human", dot: "bg-warning", pill: "bg-warning/10 text-warning" },
  HUMAN: { label: "With team", dot: "bg-success", pill: "bg-success/10 text-success" },
  RESOLVED: { label: "Resolved", dot: "bg-faint", pill: "bg-raised text-muted" },
};
const state = (s: string) => STATES[s] || STATES.WAITING!;

function time(value: string) {
  const d = new Date(value);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function waited(value: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 48 * 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d`;
}
const customerName = (c: InboxConversation["customer"]) => c.name || c.email || "Visitor";
const initials = (text: string) =>
  text
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function Sparkle({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

export function SupportInbox({
  projectId,
  conversations,
  teamMembers,
  currentUserId,
  connectors,
  aiReady,
  request,
  refresh,
  selected,
  onSelect: setSelected,
  onOpenConnectors,
}: {
  projectId: string;
  conversations: InboxConversation[];
  teamMembers: TeamMember[];
  currentUserId: string;
  connectors: { name: string; enabled: boolean }[];
  aiReady: boolean;
  request: Request;
  refresh: () => Promise<void>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpenConnectors?: (() => void) | undefined;
}) {
  const endpoint = `/api/projects/${projectId}/support`;
  const [view, setView] = useState<ViewId>("OPEN");
  const [search, setSearch] = useState("");
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [conversation, setConversation] = useState<InboxConversation | null>(null);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [assisting, setAssisting] = useState<"summary" | "draft" | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [details, setDetails] = useState(false);
  const pendingReply = useRef<{ id: string; content: string; note: boolean; conversationId: string | null } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const loadConversation = useCallback(async () => {
    if (!selected) return setConversation(null);
    try {
      const value = await request(`${endpoint}/conversations/${selected}`);
      if (selectedRef.current === selected) setConversation(value);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [endpoint, request, selected]);
  useEffect(() => {
    setConversation(null);
    void loadConversation();
    const t = setInterval(() => {
      if (!document.hidden) void loadConversation();
    }, 2500);
    return () => clearInterval(t);
  }, [loadConversation]);
  const count = conversation?.messages.length ?? 0;
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation?.id, count, summaries]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return false;
    setBusy(true);
    setError("");
    try {
      await request(`${endpoint}/conversations/${selected}`, "POST", { action, ...extra });
      await Promise.all([refresh(), loadConversation()]);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send(resolveAfter = false) {
    const content = message.trim();
    if (!content || !selected) return;
    const note = mode === "note";
    if (
      !pendingReply.current ||
      pendingReply.current.content !== message ||
      pendingReply.current.note !== note ||
      pendingReply.current.conversationId !== selected
    )
      pendingReply.current = { id: crypto.randomUUID(), content: message, note, conversationId: selected };
    const ok = await act(note ? "note" : "reply", { content: message, clientMessageId: pendingReply.current.id });
    if (!ok) return;
    setMessage("");
    pendingReply.current = null;
    if (resolveAfter && !note) await act("resolve");
  }
  async function assist(intent: "summary" | "draft") {
    if (!selected || !conversation) return;
    setAssisting(intent);
    setError("");
    try {
      if (intent === "draft" && !(conversation.state === "HUMAN" && conversation.assignedToId === currentUserId)) {
        await request(`${endpoint}/conversations/${selected}`, "POST", { action: "takeover" });
        await Promise.all([refresh(), loadConversation()]);
      }
      const result = await request(`${endpoint}/conversations/${selected}/assist`, "POST", { intent });
      if (intent === "summary") setSummaries((s) => ({ ...s, [selected]: result.text }));
      else {
        setMode("reply");
        setMessage(result.text);
        composerRef.current?.focus();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssisting(null);
    }
  }

  const views = useMemo(() => {
    const match: Record<ViewId, (c: InboxConversation) => boolean> = {
      OPEN: (c) => c.state !== "RESOLVED",
      WAITING: (c) => c.state === "WAITING",
      MINE: (c) => c.assignedToId === currentUserId && c.state !== "RESOLVED",
      AI: (c) => c.state === "AI",
      RESOLVED: (c) => c.state === "RESOLVED",
      ALL: () => true,
    };
    const list: [ViewId, string, string][] = [
      ["OPEN", "Open", "bg-ink"],
      ["WAITING", "Needs a human", "bg-warning"],
      ["MINE", "Assigned to me", "bg-success"],
      ["AI", "AI handling", "bg-info"],
      ["RESOLVED", "Resolved", "bg-faint"],
      ["ALL", "All", "bg-line-strong"],
    ];
    return list.map(([id, label, dot]) => ({
      id,
      label,
      dot,
      match: match[id],
      count: conversations.filter(match[id]).length,
    }));
  }, [conversations, currentUserId]);
  const active = views.find((v) => v.id === view)!;
  const query = search.trim().toLowerCase();
  const visible = conversations
    .filter(active.match)
    .filter(
      (c) =>
        !query ||
        [c.customer.name, c.customer.email, c.messages[0]?.content]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(query)),
    )
    .sort((a, b) =>
      view === "WAITING"
        ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        : 0,
    );

  const member = (id: string | null) => teamMembers.find((m) => m.id === id);
  const teammateFor = (authorName: string) =>
    teamMembers.find((m) => (m.name?.trim() || m.email) === authorName.trim());
  const assignee = member(conversation?.assignedToId ?? null);
  const mine = conversation?.state === "HUMAN" && conversation.assignedToId === currentUserId;
  const lockedByOther =
    conversation?.state === "HUMAN" && !!conversation.assignedToId && !mine;

  const statusOptions: SelectOption<string>[] = [
    { value: "AI", label: "AI handling", dot: "bg-info", description: "AI replies to new messages" },
    { value: "WAITING", label: "Needs a human", dot: "bg-warning", description: "Back to the queue for anyone" },
    { value: "HUMAN", label: "With team", dot: "bg-success", description: "You take over and reply" },
    { value: "RESOLVED", label: "Resolved", dot: "bg-faint", description: "Close the conversation" },
  ];
  const assigneeOptions: SelectOption<string>[] = [
    { value: "", label: "Unassigned", description: "Anyone on the team can pick it up" },
    ...teamMembers.map((m) => ({
      value: m.id,
      label: `${m.name || m.email}${m.id === currentUserId ? " (you)" : ""}`,
      ...(m.name ? { description: m.email } : {}),
    })),
  ];
  const changeStatus = (next: string) => {
    if (!conversation || next === conversation.state) return;
    if (next === "AI") void act("ai");
    else if (next === "WAITING") void act("assign", { assigneeId: null });
    else if (next === "HUMAN") void act("takeover");
    else void act("resolve");
  };
  const history = conversation
    ? conversations.filter((c) => c.customerId === conversation.customerId && c.id !== conversation.id)
    : [];

  const viewRail = (
    <nav aria-label="Inbox views" className="flex flex-col gap-0.5">
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          aria-current={view === v.id ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${view === v.id ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.dot}`} />
          <span className="flex-1 truncate">{v.label}</span>
          <span className="text-xs tabular-nums text-faint">{v.count}</span>
        </button>
      ))}
    </nav>
  );

  const contextPanel = conversation && (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-center justify-between min-[1720px]:hidden">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Details</h3>
        <button
          onClick={() => setDetails(false)}
          aria-label="Close details"
          className="rounded-md p-1 text-muted transition hover:bg-raised hover:text-ink"
        >
          <SupportIcon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold text-ink-soft">
          {initials(customerName(conversation.customer))}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
            {customerName(conversation.customer)}
          </p>
          <p className="truncate text-xs text-muted">{conversation.customer.email || "No email shared"}</p>
        </div>
      </div>
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${conversation.customer.verified ? "bg-success/10 text-success" : "bg-raised text-muted"}`}
      >
        {conversation.customer.verified ? (
          <>
            <SupportIcon name="check" className="h-3 w-3" /> Signed in on your site
          </>
        ) : (
          "Guest visitor"
        )}
      </span>
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["Status", state(conversation.state).label],
          ["Assignee", assignee ? assignee.name || assignee.email : "Unassigned"],
          ["Started", time(conversation.createdAt)],
          ["Last activity", time(conversation.updatedAt)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-card px-2.5 py-2">
            <dt className="text-[10.5px] text-faint">{k}</dt>
            <dd className="mt-0.5 truncate text-xs font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Live data</h3>
        {connectors.filter((c) => c.enabled).length ? (
          <div className="rounded-xl border border-line bg-card p-3 text-xs leading-5 text-muted">
            {conversation.customer.verified ? (
              <>
                The AI can check{" "}
                <strong className="text-ink">{connectors.filter((c) => c.enabled).map((c) => c.name).join(", ")}</strong>{" "}
                for this customer. Lookups appear above its replies.
              </>
            ) : (
              <>Connectors stay off for guests. They run once the customer signs in on your site.</>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong p-3 text-xs leading-5 text-muted">
            Connect your orders or billing API so the AI can answer “where’s my order?” on its own.
            {onOpenConnectors && (
              <button onClick={onOpenConnectors} className="mt-1.5 block font-semibold text-clay">
                Set up a connector →
              </button>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Ticket</h3>
        {conversation.ticketId ? (
          <Link
            href={`/dashboard/projects/${projectId}?issue=${conversation.ticketId}`}
            className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2.5 text-xs font-semibold text-ink transition hover:bg-raised"
          >
            {conversation.ticketReference || "Open ticket"}
            <SupportIcon name="link" className="h-3.5 w-3.5 text-faint" />
          </Link>
        ) : (
          <button
            disabled={busy}
            onClick={() => void act("ticket")}
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-xs font-medium text-ink transition hover:bg-raised disabled:opacity-50"
          >
            <SupportIcon name="ticket" className="h-3.5 w-3.5 text-faint" />
            Create a private ticket on your board
          </button>
        )}
        {conversation.ticketError && <p className="text-xs text-warning">{conversation.ticketError}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Earlier conversations</h3>
        {history.length ? (
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            {history.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-raised"
              >
                <span className="block truncate text-xs text-ink">{c.messages[0]?.content || "Conversation"}</span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  {time(c.updatedAt)} · {state(c.state).label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-faint">First conversation with this customer.</p>
        )}
      </section>
    </div>
  );

  return (
    <div className="relative grid min-h-[620px] overflow-hidden rounded-2xl border border-line bg-card md:grid-cols-[280px_minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[176px_300px_minmax(0,1fr)] min-[1720px]:grid-cols-[176px_320px_minmax(0,1fr)_300px]">
      <aside className="hidden flex-col gap-5 border-r border-line bg-surface p-3 xl:flex xl:min-h-0">
        <span className="px-2.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Views</span>
        {viewRail}
      </aside>

      <section
        aria-label="Conversations"
        className={`min-w-0 flex-col border-line md:flex md:border-r lg:min-h-0 ${selected ? "hidden" : "flex"}`}
      >
        <div className="flex flex-col gap-2.5 border-b border-line p-3">
          <div className="xl:hidden">
            <SupportSelect
              label="Inbox view"
              value={view}
              options={views.map((v) => ({ value: v.id, label: `${v.label} · ${v.count}`, dot: v.dot }))}
              onChange={setView}
            />
          </div>
          <div className="hidden items-baseline gap-2 px-1 xl:flex">
            <h2 className="text-[15px] font-semibold text-ink">{active.label}</h2>
            <span className="text-xs text-faint">{visible.length}</span>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-faint focus-within:border-clay">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              aria-label="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or message"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </label>
        </div>
        <div className="max-h-[640px] flex-1 overflow-y-auto lg:max-h-none lg:min-h-0">
          {visible.map((c) => {
            const s = state(c.state);
            const owner = member(c.assignedToId);
            const on = selected === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setError("");
                  setDetails(false);
                }}
                aria-current={on ? "true" : undefined}
                className={`flex w-full gap-3 border-b border-l-[3px] border-b-line px-3.5 py-3 text-left transition ${on ? "border-l-clay bg-clay-tint" : "border-l-transparent hover:bg-raised"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-[11px] font-semibold text-ink-soft">
                  {initials(customerName(c.customer))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <strong className="truncate text-[13px] font-semibold text-ink">{customerName(c.customer)}</strong>
                    {c.customer.verified && (
                      <SupportIcon name="check" className="h-3 w-3 shrink-0 text-success" />
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-faint">{time(c.updatedAt)}</span>
                  </span>
                  <span className="line-clamp-2 text-xs leading-[1.45] text-muted">
                    {c.messages[0]?.content || "New conversation"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${s.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                    {c.state === "WAITING" && (
                      <span className="text-[10.5px] text-warning">waiting {waited(c.updatedAt)}</span>
                    )}
                    {c.aiPending && <span className="text-[10.5px] text-info">AI typing…</span>}
                    {owner && (
                      <span className="ml-auto" title={`Assigned to ${owner.name || owner.email}`}>
                        <Avatar name={owner.name} email={owner.email} src={owner.image} size={18} decorative />
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          {!visible.length && (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium text-ink">
                {query ? "No matches" : view === "WAITING" ? "Nobody is waiting" : "Nothing here yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {query
                  ? "Try a name, email or part of a message."
                  : "New customer conversations appear here as they arrive."}
              </p>
            </div>
          )}
        </div>
      </section>

      {conversation ? (
        <section aria-label="Conversation" className="flex min-w-0 flex-col lg:min-h-0">
          <header className="flex flex-col gap-2.5 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-muted hover:bg-raised md:hidden"
                aria-label="Back to conversations"
              >
                <SupportIcon name="chevron" className="h-4 w-4 rotate-90" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-ink">{customerName(conversation.customer)}</h2>
                <p className="truncate text-xs text-faint">
                  {conversation.customer.email || "No email shared"} · started {time(conversation.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setDetails((d) => !d)}
                aria-expanded={details}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-raised min-[1720px]:hidden"
              >
                Details
              </button>
              {conversation.state !== "RESOLVED" && (
                <button
                  disabled={busy}
                  onClick={() => void act("resolve")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  <SupportIcon name="check" className="h-3.5 w-3.5" />
                  Resolve
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <SupportSelect
                label="Conversation status"
                value={conversation.state}
                options={statusOptions}
                onChange={changeStatus}
                disabled={busy}
                className="w-[168px]"
              />
              <SupportSelect
                label="Assignee"
                value={conversation.assignedToId || ""}
                options={assigneeOptions}
                onChange={(v) => void act("assign", { assigneeId: v || null })}
                disabled={busy}
                className="w-[200px]"
                prefix={
                  assignee ? (
                    <Avatar name={assignee.name} email={assignee.email} src={assignee.image} size={18} decorative />
                  ) : (
                    <SupportIcon name="person" className="h-3.5 w-3.5" />
                  )
                }
              />
            </div>
          </header>

          {error && (
            <p role="alert" className="border-b border-danger/20 bg-danger/5 px-4 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div ref={threadRef} className="flex max-h-[520px] min-h-[320px] flex-1 flex-col gap-3.5 overflow-y-auto bg-surface px-5 py-4 lg:max-h-none lg:min-h-0">
            {summaries[conversation.id] ? (
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-clay">
                  <Sparkle /> Catch-up
                  <span className="ml-auto font-normal text-faint">written by AI · check before acting</span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-ink-soft">{summaries[conversation.id]}</p>
              </div>
            ) : (
              conversation.messages.filter((m) => m.role !== "SYSTEM").length > 3 &&
              aiReady && (
                <button
                  onClick={() => void assist("summary")}
                  disabled={!!assisting}
                  className="inline-flex items-center gap-1.5 self-center rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink shadow-soft transition hover:bg-raised disabled:opacity-60"
                >
                  <Sparkle /> {assisting === "summary" ? "Summarising…" : "Catch me up"}
                </button>
              )
            )}
            {conversation.aiError && conversation.state === "WAITING" && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink">
                {conversation.aiError}
              </p>
            )}
            {conversation.messages.map((m) => {
              const at = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              if (m.role === "SYSTEM")
                return (
                  <div key={m.id} className="flex items-center gap-3 text-[11px] text-faint">
                    <span className="h-px flex-1 bg-line" />
                    <span className="max-w-[70%] text-center">
                      {m.content} · {at}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                );
              if (m.role === "NOTE")
                return (
                  <div key={m.id} className="rounded-xl border border-dashed border-warning/50 bg-warning/10 px-4 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                      <SupportIcon name="lock" className="h-3 w-3" />
                      Private note · team only
                      <span className="ml-auto flex items-center gap-1.5 font-normal text-faint">
                        {teammateFor(m.authorName) && (
                          <Avatar name={m.authorName} src={teammateFor(m.authorName)?.image} size={16} decorative />
                        )}
                        {m.authorName} · {at}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{m.content}</p>
                  </div>
                );
              const agent = m.role === "AGENT";
              const ai = m.role === "ASSISTANT";
              const lookups = ai ? m.metadata?.lookups || [] : [];
              return (
                <div key={m.id} className={`flex max-w-[82%] gap-2.5 ${agent ? "flex-row-reverse self-end" : "self-start"}`}>
                  {agent ? (
                    <Avatar name={m.authorName} src={teammateFor(m.authorName)?.image} size={28} decorative />
                  ) : ai ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-info/10 text-info">
                      <Sparkle />
                    </span>
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-[10px] font-semibold text-ink-soft">
                      {initials(customerName(conversation.customer))}
                    </span>
                  )}
                  <div className={`flex min-w-0 flex-col gap-1 ${agent ? "items-end" : "items-start"}`}>
                    <span className="px-1 text-[11px] text-faint">
                      <strong className="font-semibold text-muted">{m.authorName}</strong>
                      {ai && <span className="ml-1 rounded border border-info/30 bg-info/10 px-1 text-[10px] font-bold text-info">AI</span>} · {at}
                    </span>
                    {lookups.length > 0 && (
                      <details className="rounded-xl border border-line bg-card px-3 py-2 text-xs">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-muted">
                          <SupportIcon name="database" className="h-3.5 w-3.5" />
                          AI made {lookups.length} read-only lookup{lookups.length === 1 ? "" : "s"}
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1">
                          {lookups.map((l, i) => (
                            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold text-ink">{l.connector}</span>
                              <span className="font-mono text-[11px] text-muted">{l.action}</span>
                              <span className={l.ok ? "text-success" : "text-danger"}>
                                {l.ok ? `→ ${l.status === 404 ? "no match" : "found"}` : "→ failed"} · {l.ms} ms
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div
                      className={`px-3.5 py-2.5 ${agent ? "rounded-2xl rounded-tr-md bg-primary text-primary-fg" : ai ? "rounded-2xl rounded-tl-md border border-info/25 bg-info/10 text-ink" : "rounded-2xl rounded-tl-md border border-line bg-card text-ink shadow-soft"}`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.content}</p>
                      {!!m.metadata?.citations?.length && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.metadata.citations.map((c) => (
                            <a
                              key={c.url}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-md border border-line bg-card px-1.5 py-0.5 text-[11px] text-info hover:underline"
                            >
                              <SupportIcon name="link" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {conversation.aiPending && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-info/10 text-info">
                  <Sparkle />
                </span>
                AI is writing a reply…
              </p>
            )}
          </div>

          <form
            className="shrink-0 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div
              className={`overflow-hidden rounded-xl border transition ${mode === "note" ? "border-warning/50 bg-warning/5" : "border-line bg-card focus-within:border-clay"}`}
            >
              <div role="tablist" aria-label="Message type" className="flex items-center gap-1 px-2 pt-2">
                {(["reply", "note"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition ${mode === m ? (m === "note" ? "bg-warning/15 text-warning" : "bg-raised text-ink") : "text-muted hover:text-ink"}`}
                  >
                    {m === "note" && <SupportIcon name="lock" className="h-3 w-3" />}
                    {m === "reply" ? "Reply" : "Private note"}
                  </button>
                ))}
                <span className="ml-auto hidden truncate pl-2 text-[11px] text-faint sm:inline">
                  {mode === "note"
                    ? "Only your team sees this"
                    : lockedByOther
                      ? `${assignee?.name || "A teammate"} is handling this. Reassign to reply.`
                      : conversation.state === "RESOLVED"
                        ? "Resolved. Change the status to reopen."
                        : "The customer sees your name"}
                </span>
              </div>
              <textarea
                ref={composerRef}
                aria-label={mode === "note" ? "Private note" : "Reply to customer"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={4000}
                rows={3}
                placeholder={mode === "note" ? "Add context for your team…" : "Write a reply…"}
                className="block w-full resize-none bg-transparent px-3.5 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-faint"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-2.5 py-2">
                {mode === "reply" && aiReady && conversation.state !== "RESOLVED" && !lockedByOther && (
                  <button
                    type="button"
                    disabled={!!assisting || busy}
                    onClick={() => void assist("draft")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-clay/40 bg-clay-tint px-2.5 py-1.5 text-xs font-semibold text-clay transition hover:border-clay disabled:opacity-60"
                  >
                    <Sparkle />
                    {assisting === "draft" ? "Drafting…" : mine ? "Draft with AI" : "Take over & draft"}
                  </button>
                )}
                <span className="hidden text-[11px] text-faint sm:inline">⌘↵ to send</span>
                <div className="ml-auto flex items-center gap-2">
                  {mode === "reply" && conversation.state !== "RESOLVED" && (
                    <button
                      type="button"
                      disabled={busy || !message.trim() || lockedByOther}
                      onClick={() => void send(true)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-raised disabled:opacity-40"
                    >
                      Send & resolve
                    </button>
                  )}
                  <button
                    disabled={
                      busy ||
                      !message.trim() ||
                      (mode === "reply" && (lockedByOther || conversation.state === "RESOLVED"))
                    }
                    className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-40"
                  >
                    {mode === "note" ? "Add note" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      ) : (
        <div className={`min-h-[380px] place-items-center p-8 text-center md:grid min-[1720px]:col-span-2 ${selected ? "grid" : "hidden"}`}>
          {selected ? (
            <p className="text-sm text-muted">Loading conversation…</p>
          ) : (
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-card text-faint shadow-soft">
                <SupportIcon name="message" className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-ink">Pick a conversation</h2>
              <p className="mt-1.5 text-xs text-muted">
                {views.find((v) => v.id === "WAITING")!.count
                  ? `${views.find((v) => v.id === "WAITING")!.count} waiting for a human.`
                  : "The AI handles first questions; anything it hands off lands in Needs a human."}
              </p>
            </div>
          )}
        </div>
      )}

      {conversation && (
        <aside
          aria-label="Customer details"
          className={`border-l border-line bg-surface lg:min-h-0 ${details ? "absolute inset-y-0 right-0 z-20 flex w-[300px] max-w-full flex-col shadow-lift min-[1720px]:static min-[1720px]:w-auto min-[1720px]:shadow-none" : "hidden min-[1720px]:flex min-[1720px]:flex-col"}`}
        >
          {contextPanel}
        </aside>
      )}
    </div>
  );
}
