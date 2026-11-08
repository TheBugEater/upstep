"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Message = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  metadata?: {
    citations?: { url: string; title: string }[];
    offerTicket?: boolean;
  };
};
type Chat = {
  id: string;
  state: string;
  ticketId: string | null;
  aiPending: boolean;
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
  const [config, setConfig] = useState<Config | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<{ id: string; state: string }[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    const content = message.trim();
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
      if (snapshot !== epoch.current) return;
      pendingMessage.current = null;
      setMessage("");
      await refresh(c.id);
      const items = await request("/conversations");
      setHistory(items.conversations);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex h-[100dvh] flex-col bg-white text-black dark:bg-black dark:text-white">
      <header className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-xl dark:bg-neutral-900">
            ✦
          </span>
          <div>
            <h1 className="text-sm font-semibold">
              {config?.businessName || "Customer support"}
            </h1>
            <p className="mt-1 text-[11px] text-neutral-500">
              {chat?.state === "HUMAN"
                ? `${chat.messages.filter((m) => m.role === "AGENT").at(-1)?.authorName || "The team"} is here to help`
                : chat?.state === "WAITING"
                  ? "Waiting for the team"
                  : chat?.state === "RESOLVED"
                    ? "Conversation resolved"
                    : config?.online.length
                      ? `${config.online
                          .map((x) => x.name)
                          .slice(0, 2)
                          .join(" & ")} available`
                      : config?.mode === "HUMAN_ONLY"
                        ? "Leave a message for the team"
                        : "AI support · Human help when available"}
            </p>
          </div>
        </div>
        {history.length > 1 && (
          <select
            aria-label="Conversation history"
            className={`${control} mt-3 w-full`}
            value={chat?.id || ""}
            onChange={(e) => void refresh(e.target.value)}
          >
            <option disabled value="">
              Previous conversations
            </option>
            {history.map((c, i) => (
              <option key={c.id} value={c.id}>
                Conversation {history.length - i} · {c.state.toLowerCase()}
              </option>
            ))}
          </select>
        )}
      </header>
      <div
        ref={list}
        role="log"
        aria-label="Support conversation"
        aria-live="polite"
        className="flex-1 space-y-4 overflow-y-auto p-5"
      >
        {!chat && (
          <div className="pt-5">
            <h2 className="text-xl font-semibold">How can we help?</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              {config?.welcomeMessage || "Ask a question about the business."}
            </p>
            <p className="mt-4 text-[11px] leading-5 text-neutral-400">
              You can start without sharing your email. AI answers may need
              checking; ask for the team whenever you like.
            </p>
          </div>
        )}
        {chat?.messages.map((m) => (
          <div
            key={m.id}
            className={`${m.role === "CUSTOMER" ? "ml-10 bg-neutral-900 text-white dark:bg-white dark:text-black" : m.role === "SYSTEM" ? "text-neutral-500" : "mr-6 bg-neutral-100 dark:bg-neutral-900"} rounded-2xl px-4 py-3`}
          >
            <p className="mb-1 text-[10px] font-semibold opacity-60">
              {m.authorName}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {m.content}
            </p>
            {m.metadata?.citations?.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block truncate text-xs underline opacity-70"
              >
                ↗ {s.title}
              </a>
            ))}
            {m.metadata?.offerTicket && !chat.ticketId && (
              <button
                disabled={busy}
                onClick={() => void act("ticket")}
                className={`${control} mt-3`}
              >
                Create private ticket
              </button>
            )}
          </div>
        ))}
        {chat?.aiPending && (
          <p className="text-xs text-neutral-500" role="status">
            AI is thinking…
          </p>
        )}
      </div>
      <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {error && (
          <p
            role="alert"
            className="mb-3 text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-3 text-xs text-neutral-500">
            {notice}
          </p>
        )}
        {chat?.state === "RESOLVED" ? (
          <button
            className={`${control} w-full`}
            onClick={() => {
              setChat(null);
              setMessage("");
            }}
          >
            Start a new conversation
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="support-message" className="sr-only">
              Your message
            </label>
            <textarea
              id="support-message"
              placeholder="Ask us anything…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              maxLength={4000}
              rows={2}
              className={`${control} w-full resize-none text-sm`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chat && (
                <>
                  <button
                    type="button"
                    disabled={
                      busy || chat.state === "HUMAN" || chat.state === "WAITING"
                    }
                    onClick={() => void act("human")}
                    className={control}
                  >
                    Talk to a person
                  </button>
                  {!chat.ticketId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act("ticket")}
                      className={control}
                    >
                      Create ticket
                    </button>
                  )}
                </>
              )}
              <button
                disabled={busy || !message.trim() || !config}
                className={`${control} ml-auto !bg-black !text-white dark:!bg-white dark:!text-black`}
              >
                {busy ? "Sending…" : "Send ↑"}
              </button>
            </div>
          </form>
        )}
        {chat && !chat.customer.verified && (
          <button
            className="mt-3 text-[11px] text-neutral-500 underline"
            onClick={() => {
              setName(chat.customer.name || "");
              setEmail(chat.customer.email || "");
              setShowContact(!showContact);
            }}
          >
            {" "}
            {chat.customer.email
              ? "Update contact details"
              : "Add your name or email (optional)"}
          </button>
        )}
        {showContact && chat && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act("contact", { name, email }).then((ok) => {
                if (ok) {
                  setShowContact(false);
                  setNotice("Contact details saved for the team.");
                }
              });
            }}
          >
            <input
              aria-label="Your name"
              placeholder="Name (optional)"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${control} w-full`}
            />
            <input
              aria-label="Your email"
              type="email"
              placeholder="Email (optional)"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${control} w-full`}
            />
            <button disabled={busy} className={control}>
              Save details
            </button>
          </form>
        )}
        {config?.showBranding !== false && (
          <p className="mt-3 text-center text-[10px] text-neutral-400">
            Powered by{" "}
            <a
              href="https://upstep.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              UpStep
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
