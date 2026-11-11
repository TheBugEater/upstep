"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BusinessAvatar } from "./BusinessAvatar";
import { SupportWidgets } from "./SupportWidgets";
import type { SupportWidget } from "@upstep/types";
import { SupportIcon } from "./SupportIcons";
import { useSupportUnread } from "./useSupportUnread";
import { playChime } from "@/lib/support/chime";
import { preview } from "@/lib/support/unread";
type Message = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  createdAt?: string;
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
  logoUrl?: string | null;
  welcomeMessage: string;
  mode: string;
  showBranding?: boolean;
  domain?: string;
  online: { name: string }[];
};
const noMessages: Message[] = [];
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
  const soundKey = `upstep-support-sound:${apiKey}`;
  // The host page tells us when the chat is on screen. A page with no host counts as visible.
  const [shown, setShown] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [sound, setSound] = useState(true);
  const framed = useRef(false);
  const parentOrigin = useRef<string | null>(null);
  const handshake = useRef(false);
  const soundOn = useRef(true);
  const lastIncoming = useRef<Message | null>(null);
  const posted = useRef(0);
  const viewing = shown && atBottom && tabVisible;
  const { count, firstUnread, clearDivider } = useSupportUnread({
    storageKey: `upstep-support-seen:${apiKey}`,
    chatId: chat?.id ?? null,
    messages: chat?.messages ?? noMessages,
    viewing,
    onIncoming: (latest, wasViewing) => {
      lastIncoming.current = latest;
      // AI replies the customer is already watching stay quiet; team replies always ping.
      if (wasViewing && latest.role !== "AGENT") return;
      // The host page plays the sound when the chat is closed, since only it can.
      if (soundOn.current && (!framed.current || shown)) playChime();
    },
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(soundKey) !== "off";
      soundOn.current = saved;
      setSound(saved);
    } catch {}
    framed.current = window.parent !== window;
    // A framed chat stays "hidden" until the host page says otherwise.
    let fallback: ReturnType<typeof setTimeout> | undefined;
    if (framed.current) {
      setShown(false);
      // Previews that never hear from a host page still behave like a visible chat.
      fallback = setTimeout(() => {
        if (!handshake.current) setShown(true);
      }, 4000);
    }
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [soundKey]);
  function toggleSound() {
    const next = !sound;
    setSound(next);
    soundOn.current = next;
    try {
      localStorage.setItem(soundKey, next ? "on" : "off");
    } catch {}
    if (next) playChime();
  }
  useEffect(() => {
    // Tell the host page about unread messages so its launcher can show a count.
    if (!framed.current || !parentOrigin.current) return;
    const incoming = lastIncoming.current;
    window.parent.postMessage(
      {
        type: "upstep:support:unread",
        count,
        newMessage: count > posted.current,
        author:
          incoming?.role === "ASSISTANT"
            ? `${config?.businessName || "Support"} AI`
            : incoming?.authorName,
        preview: incoming && count ? preview(incoming.content) : "",
        sound,
      },
      parentOrigin.current,
    );
    posted.current = count;
  }, [count, sound, config?.businessName]);
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
        (event.data?.type !== "upstep:support:identity" &&
          event.data?.type !== "upstep:support:visible")
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
      parentOrigin.current = event.origin;
      handshake.current = true;
      // Hosts that predate visibility updates never send it, so treat them as visible.
      if (typeof event.data.visible === "boolean") setShown(event.data.visible);
      else setShown(true);
      if (event.data.type === "upstep:support:visible") return;
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
  const lastRole = chat?.messages.at(-1)?.role;
  useEffect(() => {
    if (!chat?.messages.length) return;
    // Do not yank the thread away from someone reading older messages.
    if (!atBottom && lastRole !== "CUSTOMER") return;
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.messages.length, chat?.aiPending]);
  useEffect(() => {
    // Reopening the chat lands on the latest message.
    if (shown) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [shown]);
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
  async function startFresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await ensureSession();
      const c = await request("/conversations", "POST", { fresh: true });
      await refresh(c.id);
      const items = await request("/conversations");
      setHistory(items.conversations);
    } catch (e) {
      setError((e as Error).message);
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
      clearDivider();
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
  const ink =
    "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900";
  const soft =
    "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100";
  // Team replies carry the business accent so they read apart from AI answers.
  const team =
    "border border-[color:color-mix(in_srgb,var(--support-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--support-accent)_12%,white)] text-neutral-900 dark:bg-[color:color-mix(in_srgb,var(--support-accent)_20%,#111)] dark:text-neutral-100";
  function clock(iso?: string) {
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return (
    <main
      style={{ "--support-accent": accentColor } as CSSProperties}
      className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-white text-neutral-950 antialiased dark:bg-black dark:text-white"
    >
      <header className="relative shrink-0 border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-900 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0">
            <BusinessAvatar
              name={business}
              logoUrl={config?.logoUrl ?? null}
              size={36}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-black ${config?.online.length || isHuman ? "bg-emerald-500" : "bg-[var(--support-accent)]"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {business}
            </h1>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="truncate">{subtitle}</span>
              {chat?.ticketReference && (
                <button
                  type="button"
                  title="Copy ticket reference"
                  aria-label={`Copy ticket reference ${chat.ticketReference}`}
                  className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[11px] font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(chat.ticketReference!)
                      .then(() => setNotice("Reference copied."))
                      .catch(() => setNotice("Use the reference above."))
                  }
                >
                  {chat.ticketReference}
                </button>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={sound}
            aria-label={sound ? "Mute message sound" : "Turn on message sound"}
            title={sound ? "Sound on" : "Sound off"}
            onClick={toggleSound}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white sm:h-8 sm:w-8"
          >
            <SupportIcon
              name={sound ? "bell" : "mute"}
              className="h-[18px] w-[18px]"
            />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white sm:h-8 sm:w-8"
            aria-label="Conversation options"
            aria-expanded={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            <SupportIcon name="more" className="h-[18px] w-[18px]" />
          </button>
        </div>
        {showHistory && (
          <div className="mt-3 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950">
            {history.length > 1 && (
              <select
                aria-label="Choose conversation"
                value={chat?.id || ""}
                className={`${control} w-full`}
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
            {chat?.supportEmail && (
              <a
                className="block truncate text-neutral-600 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-300"
                href={`mailto:${chat.supportEmail}${chat.ticketReference ? `?subject=${encodeURIComponent(`Support ${chat.ticketReference}`)}` : ""}`}
              >
                Email {chat.supportEmail}
              </a>
            )}
            {chat?.humanRequested && !chat.customer.verified && (
              <button
                type="button"
                className="font-semibold text-neutral-700 underline underline-offset-2 dark:text-neutral-200"
                onClick={() => {
                  setName(chat.customer.name || "");
                  setEmail(chat.customer.email || "");
                  setShowContact(!showContact);
                  setShowHistory(false);
                }}
              >
                Your contact details
              </button>
            )}
            <p className="text-neutral-400">
              {config?.showBranding !== false ? (
                <>
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
                `${business} support`
              )}
            </p>
          </div>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <div
          ref={list}
          role="log"
          aria-label="Support conversation"
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
          }}
          className="h-full space-y-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin] sm:px-4 sm:py-5"
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
                    className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 text-left text-sm transition hover:border-neutral-400 hover:bg-[#fafafa] dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-600 dark:hover:bg-neutral-950"
                  >
                    <SupportIcon
                      name={i === 2 ? "person" : "message"}
                      className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                    />
                    <span className="flex-1">{text}</span>
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
            const previous = chat.messages[i - 1];
            const next = chat.messages[i + 1];
            const divider = m.id === firstUnread && (
              <div
                role="separator"
                className="flex items-center gap-3 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[color:color-mix(in_srgb,var(--support-accent)_62%,#171717)] dark:text-[color:color-mix(in_srgb,var(--support-accent)_55%,white)]"
              >
                <span className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--support-accent)_50%,transparent)]" />
                New
                <span className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--support-accent)_50%,transparent)]" />
              </div>
            );
            if (m.role === "SYSTEM")
              return (
                <div key={m.id}>
                  {divider}
                  {m.metadata?.ticketReference ? (
                    <details className="my-3 rounded-xl border border-neutral-200 bg-[#fafafa] px-3.5 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                      <summary className="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                        ✓ Ticket {m.metadata.ticketReference} opened
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-5">
                        {m.content}
                      </p>
                    </details>
                  ) : (
                    <div className="my-3 flex items-center justify-center gap-2 text-center text-xs leading-5 text-neutral-400">
                      <span className="h-px w-5 bg-neutral-200 dark:bg-neutral-800" />
                      <p>{m.content}</p>
                      <span className="h-px w-5 bg-neutral-200 dark:bg-neutral-800" />
                    </div>
                  )}
                </div>
              );
            const firstOfRun =
              !previous ||
              previous.role === "SYSTEM" ||
              previous.role !== m.role ||
              previous.authorName !== m.authorName;
            const lastOfRun =
              !next ||
              next.role === "SYSTEM" ||
              next.role !== m.role ||
              next.authorName !== m.authorName;
            return (
              <div key={m.id}>
                {divider}
                <div
                  className={`flex flex-col ${customer ? "items-end" : "items-start"}`}
                >
                  {firstOfRun && !customer && (
                    <div className="mb-1 ml-0.5 mt-3 flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      {m.role === "ASSISTANT" ? `${business} AI` : m.authorName}
                      <span
                        className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${m.role === "AGENT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "border border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"}`}
                      >
                        {m.role === "ASSISTANT" ? "AI" : "Team"}
                      </span>
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 ${customer ? `${ink} ${firstOfRun ? "mt-3" : ""} rounded-br-md` : `${m.role === "AGENT" ? team : soft} rounded-tl-md`}`}
                  >
                    <div className="space-y-3">
                      {m.content.split(/\n\s*\n/).map((paragraph, n) => (
                        <p key={n} className="whitespace-pre-wrap break-words">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {!!m.metadata?.citations?.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-300/60 pt-2.5 dark:border-neutral-700">
                        {m.metadata.citations.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs leading-4 text-neutral-500 transition hover:text-neutral-900 dark:border-neutral-800 dark:bg-black dark:text-neutral-400"
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
                  {lastOfRun && clock(m.createdAt) && (
                    <span className="mx-1 mt-1 text-[11px] tabular-nums text-neutral-400">
                      {clock(m.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {chat?.aiPending && (
            <div
              role="status"
              aria-label={`${business} AI is typing`}
              className="mt-3 inline-flex gap-1 rounded-2xl rounded-tl-md bg-neutral-100 px-3.5 py-3.5 dark:bg-neutral-900"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
        </div>
        {!atBottom && count > 0 && shown && (
          <button
            type="button"
            onClick={() => {
              list.current?.scrollTo({
                top: list.current.scrollHeight,
                behavior: "smooth",
              });
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
          >
            {count} new ↓
          </button>
        )}
      </div>
      <footer className="shrink-0 bg-white px-3 pb-3 pt-1.5 dark:bg-black sm:px-4">
        {chat && widgets.length > 0 && (
          <section
            aria-label="Suggested next step"
            className="mb-2 max-h-[42dvh] overflow-y-auto"
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
            className={`${control} min-h-11 w-full`}
            onClick={() => {
              setChat(null);
              activeConversation.current = null;
              setMessage("");
            }}
          >
            Start a new conversation →
          </button>
        ) : (
          <>
            {(chat?.state === "HUMAN" || chat?.state === "WAITING") &&
              config?.mode !== "HUMAN_ONLY" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startFresh()}
                  className="mb-2 w-full text-center text-xs font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
                >
                  Different question? Start a new conversation with AI
                </button>
              )}
            <form
              className="flex items-end gap-2 rounded-3xl border-[1.5px] border-neutral-200 bg-white py-1 pl-4 pr-1 transition focus-within:border-neutral-900 dark:border-neutral-800 dark:bg-black dark:focus-within:border-neutral-300"
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
                className="block max-h-28 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              />
              <button
                aria-label="Send message"
                disabled={busy || !message.trim() || !config}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--support-accent)] text-white transition hover:brightness-95 disabled:bg-neutral-100 disabled:text-neutral-300 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-700"
              >
                <SupportIcon name="arrow" className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </footer>
    </main>
  );
}
