"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { SupportWidgets } from "./SupportWidgets";
import type { SupportWidget } from "@upstep/types";
import { SupportIcon } from "./SupportIcons";
type Message = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  metadata?: {
    citations?: { url: string; title: string }[];
    offerTicket?: boolean;
    ticketReference?: string;
    widgets?: SupportWidget[];
  };
};
type Chat = {
  id: string;
  state: string;
  ticketId: string | null;
  ticketReference: string | null;
  supportEmail: string | null;
  aiPending: boolean;
  canEscalate: boolean;
  escalationSummary: string | null;
  activeWidgetMessageId: string | null;
  humanRequested: boolean;
  messages: Message[];
  customer: { name: string | null; email: string | null; verified: boolean };
};
type Config = {
  businessName: string;
  welcomeMessage: string;
  mode: string;
  showBranding?: boolean;
  domain?: string;
  online: { name: string }[];
};
const control =
  "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-black disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:text-white";
export function SupportChat({ apiKey }: { apiKey: string }) {
  const [accentColor, setAccentColor] = useState("#D97757");
  const [config, setConfig] = useState<Config | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<{ id: string; state: string }[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 112)}px`;
    }
  }, [message]);
  const [showContact, setShowContact] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const token = useRef<string | null>(null);
  const identity = useRef<string | undefined>(undefined);
  const sessionPromise = useRef<Promise<void> | null>(null);
  const epoch = useRef(0);
  const activeConversation = useRef<string | null>(null);
  const pendingMessage = useRef<{ id: string; content: string } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const storageKey = `upstep-support:${apiKey}`;
  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const requestEpoch = epoch.current;
      const response = await fetch(`/api/sdk/support${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          ...(token.current
            ? { Authorization: `Bearer ${token.current}` }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        credentials: "omit",
      });
      const data = await response.json();
      if (!response.ok) {
        if (
          response.status === 401 &&
          path !== "" &&
          requestEpoch === epoch.current
        ) {
          token.current = null;
          setChat(null);
          setHistory([]);
          try {
            localStorage.removeItem(storageKey);
          } catch {}
        }
        throw new Error(data.error || "Could not connect. Please try again.");
      }
      return data;
    },
    [apiKey, storageKey],
  );
  const refresh = useCallback(
    async (id: string) => {
      const snapshot = epoch.current;
      activeConversation.current = id;
      const data = await request(`/conversations/${id}`);
      if (snapshot === epoch.current && activeConversation.current === id)
        setChat(data);
    },
    [request],
  );
  const ensureSession = useCallback(async () => {
    if (token.current) return;
    if (!sessionPromise.current) {
      const snapshot = epoch.current;
      sessionPromise.current = request(
        "",
        "POST",
        identity.current ? { identityToken: identity.current } : {},
      )
        .then((data) => {
          if (snapshot !== epoch.current)
            throw new Error("Identity changed. Please try again.");
          token.current = data.token;
          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                token: data.token,
                identified: !!identity.current,
              }),
            );
          } catch {}
        })
        .finally(() => {
          sessionPromise.current = null;
        });
    }
    await sessionPromise.current;
  }, [request, storageKey]);
  useEffect(() => {
    const accent = new URLSearchParams(location.search).get("accent");
    if (accent && accent.length <= 256 && CSS.supports("color", accent))
      setAccentColor(accent);
    document.documentElement.classList.toggle(
      "dark",
      new URLSearchParams(location.search).get("theme") === "dark",
    );
  }, []);
  useEffect(() => {
    let active = true;
    void request("")
      .then((data: Config) => {
        if (active) setConfig(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.token && !saved.identified) token.current = saved.token;
    } catch {}
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.data?.type !== "upstep:support:identity"
      )
        return;
      // Only the business domain (or the UpStep dashboard preview) may set identity.
      let allowed = false;
      try {
        const origin = new URL(event.origin);
        allowed =
          origin.origin === location.origin ||
          (!!config?.domain &&
            (origin.hostname === config.domain ||
              origin.hostname.endsWith(`.${config.domain}`))) ||
          (process.env.NODE_ENV !== "production" &&
            ["localhost", "127.0.0.1"].includes(origin.hostname));
      } catch {}
      if (!allowed) return;
      const accent = event.data.accentColor;
      if (
        typeof accent === "string" &&
        accent.length <= 256 &&
        CSS.supports("color", accent)
      )
        setAccentColor(accent);
      const next =
        typeof event.data.token === "string" ? event.data.token : undefined;
      if (next === identity.current) return;
      identity.current = next;
      epoch.current++;
      token.current = null;
      setChat(null);
      setHistory([]);
      pendingMessage.current = null;
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      if (next)
        void ensureSession()
          .then(() => request("/conversations"))
          .then((data) => {
            setHistory(data.conversations);
            if (data.conversations[0]) void refresh(data.conversations[0].id);
          })
          .catch((e) => setError(e.message));
    };
    window.addEventListener("message", receive);
    if (window.parent !== window)
      window.parent.postMessage({ type: "upstep:support:ready" }, "*");
    if (token.current)
      void request("/conversations")
        .then((data) => {
          if (!active) return;
          setHistory(data.conversations);
          if (data.conversations[0]) void refresh(data.conversations[0].id);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
      window.removeEventListener("message", receive);
    };
    // Re-establish the bridge after domain discovery without repeating session restoration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, config?.domain]);
  useEffect(() => {
    if (!chat?.id) return;
    const id = chat.id;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(id).catch((e) => setError(e.message));
    }, 2500);
    return () => clearInterval(timer);
  }, [chat?.id, refresh]);
  useEffect(() => {
    if (!chat?.messages.length) return;
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat?.messages.length, chat?.aiPending]);
  async function act(action: string, extra = {}) {
    if (!chat) return;
    setBusy(true);
    setError("");
    try {
      await request(`/conversations/${chat.id}`, "POST", { action, ...extra });
      await refresh(chat.id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send(quickText?: string) {
    const outgoing = quickText ?? message;
    if (!outgoing.trim() || busy) return false;
    setBusy(true);
    setError("");
    const content = outgoing.trim();
    const snapshot = epoch.current;
    if (!pendingMessage.current || pendingMessage.current.content !== content)
      pendingMessage.current = { id: crypto.randomUUID(), content };
    try {
      await ensureSession();
      if (snapshot !== epoch.current)
        throw new Error("Identity changed. Please try again.");
      const c = chat || (await request("/conversations", "POST", {}));
      await request(`/conversations/${c.id}`, "POST", {
        action: "message",
        content,
        clientMessageId: pendingMessage.current.id,
      });
      if (snapshot !== epoch.current) return false;
      pendingMessage.current = null;
      if (!quickText) setMessage("");
      await refresh(c.id);
      const items = await request("/conversations");
      setHistory(items.conversations);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function quickReply(text: string) {
    return send(text);
  }
  const widgets = chat?.activeWidgetMessageId
    ? (
        chat.messages.find((m) => m.id === chat.activeWidgetMessageId)?.metadata
          ?.widgets || []
      ).filter((w) => w.type !== "contact_form" || chat.canEscalate)
    : chat?.canEscalate
      ? [
          {
            id: `contact:${chat.id}`,
            type: "contact_form" as const,
            title: "Let the team follow up",
            summary: chat.escalationSummary || "",
          },
        ]
      : [];
  const business = config?.businessName || "Support";
  const isHuman = chat?.state === "HUMAN";
  const subtitle = isHuman
    ? `${chat.messages.filter((m) => m.role === "AGENT").at(-1)?.authorName || "The team"} is here to help`
    : chat?.state === "WAITING"
      ? "Your message is with the team"
      : chat?.state === "RESOLVED"
        ? "Conversation resolved"
        : config?.online.length
          ? "AI and our team are here for you"
          : config?.mode === "HUMAN_ONLY"
            ? "Leave a message for the team"
            : "AI is here. The team can join when needed.";
  const suggestions = [
    "What can you help me with?",
    `I need help using ${business}`,
    "How can I reach your team?",
  ];
  function suggest(text: string) {
    setMessage(text);
    input.current?.focus();
  }
  return (
    <main
      style={{ "--support-accent": accentColor } as CSSProperties}
      className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-white text-neutral-950 antialiased dark:bg-black dark:text-white"
    >
      <header className="relative shrink-0 border-b border-neutral-100 px-5 py-4 dark:border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-neutral-200 bg-white text-base font-semibold shadow-sm dark:border-neutral-800 dark:bg-black">
            {business.charAt(0).toUpperCase()}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-black ${config?.online.length || isHuman ? "bg-emerald-500" : "bg-[var(--support-accent)]"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {business}{" "}
              <span className="ml-2 text-sm font-normal text-neutral-400">
                Support
              </span>
            </h1>
            <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          </div>
          {history.length > 1 && (
            <button
              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white"
              aria-label="Conversation history"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              <SupportIcon name="history" />
            </button>
          )}
        </div>
        {showHistory && (
          <select
            aria-label="Choose conversation"
            value={chat?.id || ""}
            className={`${control} mt-3 w-full`}
            onChange={(e) => {
              void refresh(e.target.value);
              setShowHistory(false);
            }}
          >
            <option disabled value="">
              Your conversations
            </option>
            {history.map((c, i) => (
              <option key={c.id} value={c.id}>
                Conversation {history.length - i} · {c.state.toLowerCase()}
              </option>
            ))}
          </select>
        )}
      </header>
      {chat?.ticketReference && (
        <section
          aria-label="Support ticket"
          className="shrink-0 border-b border-neutral-200 bg-[#fafafa] px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="flex items-center gap-2">
            <SupportIcon
              name="ticket"
              className="h-3.5 w-3.5 text-[#8c7565] dark:text-neutral-300"
            />
            <span className="text-sm text-neutral-500">Ticket</span>
            <strong className="font-mono text-sm font-semibold tracking-wide">
              {chat.ticketReference}
            </strong>
            <button
              aria-label="Copy ticket reference"
              className="ml-auto rounded-md p-1 text-neutral-400 transition hover:text-neutral-950 dark:hover:text-white"
              onClick={() =>
                void navigator.clipboard
                  .writeText(chat.ticketReference!)
                  .then(() => setNotice("Reference copied."))
                  .catch(() => setNotice("Use the reference above."))
              }
            >
              <SupportIcon name="copy" className="h-3.5 w-3.5" />
            </button>
          </div>
          {chat.supportEmail && (
            <a
              className="mt-1.5 block truncate text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-400"
              href={`mailto:${chat.supportEmail}?subject=${encodeURIComponent(`Support ${chat.ticketReference}`)}`}
            >
              {chat.supportEmail}
            </a>
          )}
        </section>
      )}
      <div
        ref={list}
        role="log"
        aria-label="Support conversation"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 [scrollbar-width:thin]"
      >
        {!chat && (
          <div className="mx-auto max-w-sm pt-3">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--support-accent)]" />
              {business} help desk
            </div>
            <h2 className="text-[26px] font-semibold leading-[1.13] tracking-[-0.045em]">
              Hi there.
              <br />
              <span className="text-neutral-400 dark:text-neutral-500">
                How can we help?
              </span>
            </h2>
            <p className="mt-4 text-base leading-6 text-neutral-500 dark:text-neutral-400">
              {config?.welcomeMessage ||
                "Ask a question about the business. We're here to help."}
            </p>
            <div className="mt-7 space-y-2">
              {suggestions.map((text, i) => (
                <button
                  key={text}
                  onClick={() => suggest(text)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 text-left text-sm transition hover:border-orange-300 hover:bg-[#fafafa] dark:border-neutral-800 dark:bg-black dark:hover:border-orange-800 dark:hover:bg-orange-950/10"
                >
                  <SupportIcon
                    name={i === 2 ? "person" : "message"}
                    className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  />
                  <span className="flex-1">{text}</span>
                  <span className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500">
                    ↗
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs text-neutral-400">
              No account or email needed to start.
            </p>
          </div>
        )}
        {chat?.messages.map((m, i) => {
          const customer = m.role === "CUSTOMER";
          if (m.role === "SYSTEM")
            return m.metadata?.ticketReference ? (
              <details
                key={m.id}
                className="rounded-xl border border-neutral-200 bg-[#fafafa] px-3.5 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
              >
                <summary className="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                  ✓ Ticket {m.metadata.ticketReference} opened
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-5">
                  {m.content}
                </p>
              </details>
            ) : (
              <div
                key={m.id}
                className="flex items-start gap-2 px-1 text-xs leading-5 text-neutral-400"
              >
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                <p>{m.content}</p>
              </div>
            );
          const previous = chat.messages[i - 1];
          return (
            <div
              key={m.id}
              className={`flex flex-col ${customer ? "items-end" : "items-start"}`}
            >
              {(!previous ||
                previous.role !== m.role ||
                previous.authorName !== m.authorName) && (
                <div
                  className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400 ${customer ? "pr-1" : "pl-1"}`}
                >
                  {!customer && (
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-md text-[8px] font-semibold ${m.role === "ASSISTANT" ? "bg-[#f5f5f5] text-[#8c7565] dark:bg-[#262626] dark:text-neutral-300" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900"}`}
                    >
                      {m.role === "ASSISTANT" ? "AI" : m.authorName.charAt(0)}
                    </span>
                  )}
                  {customer ? "You" : m.authorName}
                </div>
              )}
              <div
                className={`max-w-[94%] rounded-2xl px-3 py-2.5 text-[15px] leading-6 ${customer ? "rounded-tr-md bg-[#f0f0f0] text-neutral-800 dark:bg-[#202020] dark:text-neutral-100" : "rounded-tl-md border border-neutral-100 bg-[#fafafa] text-neutral-700 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-200"}`}
              >
                <div className="space-y-3">
                  {m.content.split(/\n\s*\n/).map((paragraph, n) => (
                    <p key={n} className="whitespace-pre-wrap break-words">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {!!m.metadata?.citations?.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-200/60 pt-2.5 dark:border-neutral-800">
                    {m.metadata.citations.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs leading-4 text-neutral-500 transition hover:text-[#8c7565] dark:border-neutral-800 dark:bg-black dark:text-neutral-400"
                      >
                        <SupportIcon
                          name="link"
                          className="h-2.5 w-2.5 shrink-0"
                        />
                        <span className="max-w-[180px] truncate">
                          {s.title}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {chat?.aiPending && (
          <div
            role="status"
            className="flex items-center gap-2 pl-1 text-xs text-neutral-400"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 animate-pulse rounded-full bg-[var(--support-accent)]"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
            {business} AI is typing
          </div>
        )}
      </div>
      <footer className="shrink-0 bg-white px-4 pb-3 pt-2 dark:bg-black">
        {chat && widgets.length > 0 && (
          <section
            aria-label="Suggested next step"
            className="mb-2 max-h-[38dvh] overflow-y-auto"
          >
            <SupportWidgets
              key={chat.activeWidgetMessageId || chat.id}
              widgets={widgets}
              busy={busy}
              name={chat.customer.name || ""}
              email={chat.customer.email || ""}
              verified={chat.customer.verified}
              online={!!config?.online.length}
              onReply={quickReply}
              onDetails={(data) => act("details", data).then(Boolean)}
              onContact={(name, email) =>
                act("handoff", { name, email }).then(Boolean)
              }
            />
          </section>
        )}
        {error && (
          <p
            role="alert"
            className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-2 px-1 text-xs text-neutral-500">
            {notice}
          </p>
        )}
        {showContact && chat?.humanRequested && !chat.customer.verified && (
          <form
            className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-950"
            onSubmit={(e) => {
              e.preventDefault();
              void act("contact", { name, email }).then((ok) => {
                if (ok) {
                  setShowContact(false);
                  setNotice("Your details are saved for the team.");
                }
              });
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Stay in the loop</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Optional details for the support team.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close contact details"
                onClick={() => setShowContact(false)}
                className="p-1 text-neutral-400"
              >
                <SupportIcon name="close" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                aria-label="Your name"
                placeholder="Your name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${control} min-w-0`}
              />
              <input
                aria-label="Your email"
                type="email"
                placeholder="Email address"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${control} min-w-0`}
              />
            </div>
            <button
              disabled={busy}
              className="mt-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
            >
              Save details
            </button>
          </form>
        )}
        {chat?.state === "RESOLVED" ? (
          <button
            className={`${control} w-full`}
            onClick={() => {
              setChat(null);
              activeConversation.current = null;
              setMessage("");
            }}
          >
            Start a new conversation →
          </button>
        ) : (
          <form
            className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.035)] transition focus-within:border-neutral-400 dark:border-neutral-800 dark:bg-black dark:focus-within:border-neutral-600"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="support-message" className="sr-only">
              Your message
            </label>
            <textarea
              ref={input}
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              maxLength={4000}
              rows={1}
              placeholder={`Message ${business}…`}
              className="block max-h-28 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-base leading-6 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
            />
            <div className="flex items-center gap-1">
              {chat?.humanRequested && !chat.customer.verified && (
                <button
                  type="button"
                  aria-label="Your contact details"
                  title="Your contact details"
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setName(chat.customer.name || "");
                    setEmail(chat.customer.email || "");
                    setShowContact(!showContact);
                  }}
                >
                  <SupportIcon name="person" className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                aria-label="Send message"
                disabled={busy || !message.trim() || !config}
                className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--support-accent)] text-white transition hover:brightness-95 disabled:bg-neutral-100 disabled:text-neutral-300 dark:bg-[var(--support-accent)] dark:text-white dark:disabled:bg-neutral-900 dark:disabled:text-neutral-700"
              >
                <SupportIcon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
        <div className="mt-2.5 flex items-center justify-center gap-1 text-xs text-neutral-400">
          {config?.showBranding !== false ? (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--support-accent)]" />
              Powered by{" "}
              <a
                href="https://upstep.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-500 dark:text-neutral-400"
              >
                UpStep
              </a>
            </>
          ) : (
            <span>{business} support</span>
          )}
        </div>
      </footer>
    </main>
  );
}
