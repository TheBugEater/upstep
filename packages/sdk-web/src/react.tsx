import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Comment, Feedback, FeedbackType, FeedbackWithComments, UpstepConfig } from "@upstep/types";
import { UpstepApiClient } from "./api";

const DEFAULT_ACCENT = "#D97757";

// ─── Theming ─────────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "auto";

interface Palette {
  bg: string;
  bgSoft: string;
  bgHover: string;
  text: string;
  textSoft: string;
  textFaint: string;
  border: string;
  overlay: string;
}

const LIGHT: Palette = {
  bg: "#ffffff", bgSoft: "#f6f5f2", bgHover: "#efede8",
  text: "#1a1915", textSoft: "#56544d", textFaint: "#9b9890",
  border: "#e8e6df", overlay: "rgba(26,25,21,.45)",
};
const DARK: Palette = {
  bg: "#1c1b19", bgSoft: "#262522", bgHover: "#302e2a",
  text: "#f5f4f0", textSoft: "#b4b1a8", textFaint: "#7d7a72",
  border: "#33312c", overlay: "rgba(0,0,0,.6)",
};

/** Reads the `.dark` class / `data-theme` attribute convention most apps
 *  toggle on <html>. Returns null when the page gives no explicit signal, so
 *  callers can fall back to the OS-level prefers-color-scheme. */
function detectHostTheme(): "light" | "dark" | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  if (root.classList.contains("dark") || dataTheme === "dark") return "dark";
  if (root.classList.contains("light") || dataTheme === "light") return "light";
  return null;
}

function usePalette(mode: ThemeMode): Palette {
  // Initial value must be SSR-safe (no `window` access) so it matches the
  // server-rendered markup exactly. React does not patch DOM attributes that
  // mismatch during hydration, so if this returned the real client value here,
  // the follow-up setState in the effect below (already holding that same
  // value) would be a no-op and the stale server markup would stick forever.
  const [isDark, setIsDark] = useState(() => mode === "dark");

  useEffect(() => {
    if (mode !== "auto") {
      setIsDark(mode === "dark");
      return;
    }

    // "auto" prefers the host page's own theme (the `.dark` class / `data-theme`
    // attribute it toggles on <html>) over the OS-level prefers-color-scheme,
    // since a page can be light while the OS is set to dark (or vice versa).
    // A manual class toggle fires no event, so watch it with a MutationObserver
    // rather than only re-checking once at mount.
    const host = detectHostTheme();
    if (host) {
      setIsDark(host === "dark");
      if (typeof MutationObserver === "undefined") return;
      const observer = new MutationObserver(() => {
        const next = detectHostTheme();
        if (next) setIsDark(next === "dark");
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      return () => observer.disconnect();
    }

    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    setIsDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return isDark ? DARK : LIGHT;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface UpstepContextValue {
  client: UpstepApiClient;
  feedItems: Feedback[];
  loadFeed: () => Promise<void>;
  submit: (title: string, content: string, type?: FeedbackType) => Promise<void>;
  vote: (feedbackId: string, value: "UP" | "DOWN") => Promise<void>;
  getItem: (feedbackId: string) => Promise<FeedbackWithComments>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  identify: (userId: string | undefined) => void;
  accentColor: string;
  theme: ThemeMode;
  showBranding: boolean;
}

const UpstepContext = createContext<UpstepContextValue | null>(null);

export function UpstepProvider({
  children,
  ...config
}: UpstepConfig & { children: ReactNode }) {
  const [client] = useState(() => new UpstepApiClient(config));
  const [feedItems, setFeedItems] = useState<Feedback[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBranding, setShowBranding] = useState(true);

  useEffect(() => {
    client.setUserId(config.userId);
  }, [client, config.userId]);

  const loadFeed = useCallback(async () => {
    try {
      const data = await client.listFeedback({ sort: "votes", limit: 20 });
      setFeedItems(data.items);
      setShowBranding(data.showBranding ?? true);
    } catch {
      // non-critical — feed unavailable, widget stays mounted
    }
  }, [client]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const submit = useCallback(async (title: string, content: string, type?: FeedbackType) => {
    const payload: Parameters<typeof client.submitFeedback>[0] = { content };
    if (title.trim()) payload.title = title.trim();
    if (type !== undefined) payload.type = type;
    await client.submitFeedback(payload);
    await loadFeed();
  }, [client, loadFeed]);

  const vote = useCallback(async (feedbackId: string, value: "UP" | "DOWN") => {
    try {
      await client.vote(feedbackId, value);
      await loadFeed();
    } catch {
      // vote failed silently
    }
  }, [client, loadFeed]);

  const getItem = useCallback(
    (feedbackId: string) => client.getItem(feedbackId),
    [client]
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const identify = useCallback((userId: string | undefined) => client.setUserId(userId), [client]);

  return (
    <UpstepContext.Provider
      value={{
        client, feedItems, loadFeed, submit, vote, getItem,
        isOpen, open, close, identify,
        accentColor: config.accentColor ?? DEFAULT_ACCENT,
        theme: config.theme ?? "auto",
        showBranding,
      }}
    >
      {children}
    </UpstepContext.Provider>
  );
}

export function useUpstep(): UpstepContextValue {
  const ctx = useContext(UpstepContext);
  if (!ctx) throw new Error("useUpstep must be used inside <UpstepProvider>");
  return ctx;
}

// ─── FeedbackWidget ───────────────────────────────────────────────────────────

interface FeedbackWidgetProps {
  position?: "bottom-right" | "bottom-left";
  accentColor?: string;
  theme?: ThemeMode;
  hideLauncher?: boolean;
}

type Screen = "list" | "detail" | "create";

export function FeedbackWidget({
  position = "bottom-right",
  accentColor,
  theme,
  hideLauncher = false,
}: FeedbackWidgetProps) {
  const ctx = useUpstep();
  const accent = accentColor ?? ctx.accentColor;
  const p = usePalette(theme ?? ctx.theme);
  const { isOpen: open, open: openWidget, close: closeWidget, showBranding } = ctx;
  const [screen, setScreen] = useState<Screen>("list");
  const [detailId, setDetailId] = useState<string | null>(null);
  // Same SSR-safe rule as usePalette above: start deterministic (false) so
  // hydration never mismatches, and let the effect below drive the real
  // transition once mounted.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const posStyle: React.CSSProperties =
    position === "bottom-left"
      ? { position: "fixed", bottom: 24, left: 24 }
      : { position: "fixed", bottom: 24, right: 24 };

  const font = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

  function handleClose() {
    closeWidget();
    setTimeout(() => { setScreen("list"); setDetailId(null); }, 300);
  }

  function goToDetail(id: string) {
    setDetailId(id);
    setScreen("detail");
  }

  return (
    <>
      {!hideLauncher && (
        <button
          onClick={openWidget}
          style={{
            ...posStyle, zIndex: 9998, display: "inline-flex", alignItems: "center", gap: 7,
            background: accent, color: "#fff", border: "none", borderRadius: 9999,
            padding: isMobile ? "12px" : "12px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: font, boxShadow: "0 6px 20px rgba(26,25,21,.18)",
          }}
        >
          <ChatIcon size={16} />
          {!isMobile && "Feedback"}
        </button>
      )}

      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          style={{
            position: "fixed", inset: 0, background: p.overlay, backdropFilter: "blur(3px)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, fontFamily: font,
          }}
        >
          <div
            style={{
              background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20,
              width: "100%", maxWidth: 440, maxHeight: "88vh", display: "flex",
              flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.28)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${p.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {screen !== "list" && (
                  <button
                    onClick={() => setScreen("list")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: accent, fontSize: 13, fontWeight: 600, padding: 0 }}
                  >
                    ← Back
                  </button>
                )}
                {screen === "list" && (
                  <span style={{ fontWeight: 700, fontSize: 16, color: p.text, letterSpacing: "-.01em" }}>Feedback</span>
                )}
                {screen === "create" && (
                  <span style={{ fontWeight: 700, fontSize: 16, color: p.text, letterSpacing: "-.01em" }}>New feedback</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {screen === "list" && (
                  <button
                    onClick={() => setScreen("create")}
                    style={{ background: accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    + New
                  </button>
                )}
                <button
                  onClick={handleClose}
                  style={{ background: p.bgSoft, border: "none", width: 28, height: 28, borderRadius: 8, fontSize: 14, cursor: "pointer", color: p.textSoft, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px" }}>
              {screen === "list" && (
                <FeedList
                  onSelect={goToDetail}
                  accent={accent}
                  p={p}
                />
              )}
              {screen === "detail" && detailId && (
                <FeedDetail feedbackId={detailId} accent={accent} p={p} font={font} />
              )}
              {screen === "create" && (
                <CreateForm
                  accent={accent}
                  p={p}
                  font={font}
                  onDone={() => setScreen("list")}
                />
              )}
            </div>

            {/* Branding footer — hidden for Business plan */}
            {showBranding && (
              <a
                href="https://upstep.dev"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center", padding: "8px 0",
                  borderTop: `1px solid ${p.border}`, fontSize: 11,
                  color: p.textFaint, textDecoration: "none", flexShrink: 0,
                }}
              >
                Powered by <strong style={{ fontWeight: 700 }}>Upstep.dev</strong>
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── FeedList ─────────────────────────────────────────────────────────────────

function FeedList({
  onSelect, accent, p,
}: {
  onSelect: (id: string) => void;
  accent: string;
  p: Palette;
}) {
  const { feedItems, vote } = useUpstep();

  const items = feedItems.filter((f) => f.status !== "CLOSED");

  if (!items.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ color: p.textSoft, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          No open feedback yet
        </div>
        <div style={{ color: p.textFaint, fontSize: 14 }}>
          Be the first to share one.
        </div>
      </div>
    );
  }

  return (
    <>
      {items.map((f) => {
        const voted = f.userVote === "UP";
        const title = f.title ?? f.content;
        return (
          <div
            key={f.id}
            onClick={() => onSelect(f.id)}
            style={{
              display: "flex", gap: 12, padding: 14, border: `1px solid ${p.border}`, borderRadius: 14,
              marginBottom: 10, background: p.bg, cursor: "pointer",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); vote(f.id, "UP"); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                minWidth: 46, padding: "7px 0", borderRadius: 11, cursor: "pointer", flexShrink: 0,
                border: `1px solid ${voted ? accent : p.border}`,
                background: voted ? `${accent}1a` : p.bgSoft,
              }}
            >
              <UpArrowIcon color={accent} />
              <span style={{ fontSize: 14, fontWeight: 700, color: p.text, lineHeight: 1.1 }}>{f.upvotes}</span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: p.text, margin: "0 0 6px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                {title}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <TypeBadge type={f.type} p={p} />
                {f.status === "PENDING"
                  ? <PendingBadge />
                  : <StatusBadge status={f.status} p={p} />}
                <span style={{ fontSize: 11, color: p.textFaint }}>{fmtDate(f.createdAt)}</span>
              </div>
            </div>
            <span style={{ color: p.textFaint, fontSize: 18, alignSelf: "center", flexShrink: 0 }}>›</span>
          </div>
        );
      })}
    </>
  );
}

// ─── FeedDetail ───────────────────────────────────────────────────────────────

function FeedDetail({ feedbackId, accent, p, font }: { feedbackId: string; accent: string; p: Palette; font: string }) {
  const { vote, getItem } = useUpstep();
  const [item, setItem] = useState<FeedbackWithComments | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getItem(feedbackId)
      .then((d) => { if (!cancelled) setItem(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [feedbackId, getItem]);

  async function handleVote() {
    if (!item || voting) return;
    setVoting(true);
    try {
      await vote(item.id, "UP");
      const updated = await getItem(feedbackId);
      setItem(updated);
    } catch {
      // vote or refresh failed silently
    } finally {
      setVoting(false);
    }
  }

  if (!item) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: p.textFaint, fontSize: 14 }}>Loading…</div>;
  }

  const title = item.title;

  return (
    <div>
      {title && <div style={{ fontSize: 20, fontWeight: 700, color: p.text, letterSpacing: "-.02em", marginBottom: 10, lineHeight: 1.3 }}>{title}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <TypeBadge type={item.type} p={p} />
        {item.status === "PENDING" ? <PendingBadge /> : <StatusBadge status={item.status} p={p} />}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: p.textSoft, marginBottom: 20 }}>{item.content}</p>

      <button
        onClick={handleVote}
        disabled={voting}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          border: `1px solid ${item.userVote === "UP" ? accent : p.border}`,
          background: item.userVote === "UP" ? `${accent}15` : p.bgSoft,
          borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontFamily: font,
        }}
      >
        <UpArrowIcon color={accent} size={13} />
        <span style={{ fontSize: 18, fontWeight: 700, color: p.text }}>{item.upvotes}</span>
        <span style={{ fontSize: 13, color: p.textFaint }}>{item.userVote === "UP" ? "Upvoted" : "Upvote"}</span>
      </button>

      {item.comments.length > 0 && (
        <div style={{ marginTop: 28, borderTop: `1px solid ${p.border}`, paddingTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: p.textFaint, marginBottom: 12, textTransform: "uppercase" }}>
            Developer response
          </div>
          {item.comments.map((c: Comment) => (
            <CommentBubble key={c.id} comment={c} p={p} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBubble({ comment, p, accent }: { comment: Comment; p: Palette; accent: string }) {
  return (
    <div style={{ background: p.bgSoft, border: `1px solid ${p.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ background: `${accent}20`, color: accent, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px" }}>Developer</span>
        <span style={{ fontSize: 11, color: p.textFaint }}>{fmtDate(comment.createdAt)}</span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: p.textSoft, margin: 0 }}>{comment.content}</p>
    </div>
  );
}

// ─── CreateForm ───────────────────────────────────────────────────────────────

function CreateForm({ accent, p, font, onDone }: { accent: string; p: Palette; font: string; onDone: () => void }) {
  const { submit } = useUpstep();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FeedbackType>("GENERAL");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!title.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      await submit(title.trim(), description.trim() || title.trim(), type);
      setSuccess(true);
      setTimeout(onDone, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 6 }}>Submitted</div>
        <div style={{ fontSize: 14, color: p.textFaint }}>Feedback received. Thank you.</div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: `1px solid ${p.border}`, borderRadius: 12,
    padding: "10px 12px", fontSize: 14, lineHeight: 1.5, outline: "none",
    background: p.bgSoft, color: p.text, fontFamily: font, boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: p.textFaint, marginBottom: 8, textTransform: "uppercase" }}>Type</div>
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        {(["BUG", "FEATURE", "GENERAL"] as FeedbackType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: type === t ? accent : p.bg,
              color: type === t ? "#fff" : p.textSoft,
              border: `1px solid ${type === t ? accent : p.border}`,
              fontFamily: font,
            }}
          >
            {TYPE_META[t].icon}
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: p.textFaint, marginBottom: 8, textTransform: "uppercase" }}>Title</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short summary of the issue or idea"
        maxLength={200}
        style={{ ...inputStyle, marginBottom: 16, display: "block" }}
      />

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: p.textFaint, marginBottom: 8, textTransform: "uppercase" }}>Description <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Steps to reproduce, expected behaviour, or more context"
        maxLength={2000}
        rows={4}
        style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
      />

      {error && <p style={{ fontSize: 13, color: "#d6453d", marginBottom: 12 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !title.trim()}
        style={{
          width: "100%", padding: 12, background: accent, color: "#fff", border: "none",
          borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: "pointer",
          opacity: loading || !title.trim() ? 0.5 : 1, fontFamily: font,
        }}
      >
        {loading ? "Submitting…" : "Submit feedback"}
      </button>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const TYPE_META: Record<FeedbackType, { icon: React.ReactNode; label: string }> = {
  BUG: {
    label: "Bug",
    icon: (
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="8" cy="10" rx="3.5" ry="4.5" />
        <path d="M8 5.5V4M5.5 6.5 3.5 5M10.5 6.5 12.5 5M4.5 10.5 2.5 10M11.5 10.5 13.5 10" />
      </svg>
    ),
  },
  FEATURE: {
    label: "Feature",
    icon: (
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1" />
        <circle cx="8" cy="8" r="2.5" />
      </svg>
    ),
  },
  GENERAL: {
    label: "General",
    icon: (
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9a2 2 0 0 1-2 2H5L2 14V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5z" />
      </svg>
    ),
  },
};

const TYPE_BG: Record<string, string> = { BUG: "#fdecec", FEATURE: "#e9f0fd" };
const TYPE_FG: Record<string, string> = { BUG: "#d6453d", FEATURE: "#3b76d6" };

function TypeBadge({ type, p }: { type: FeedbackType; p: Palette }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 9999, fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em",
      background: TYPE_BG[type] ?? p.bgSoft,
      color: TYPE_FG[type] ?? p.textSoft,
    }}>
      {type}
    </span>
  );
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#b45309", IN_PROGRESS: "#1d4ed8", DONE: "#15803d", CLOSED: "#6b7280",
};

function PendingBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700, color: "#ea580c" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ea580c", display: "inline-block" }} />
      Pending review
    </span>
  );
}

function StatusBadge({ status, p }: { status: string; p: Palette }) {
  const color = STATUS_COLOR[status] ?? "#9ca3af";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: p.bgSoft, border: `1px solid ${p.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: p.textSoft }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {status.replace("_", " ")}
    </span>
  );
}

function ChatIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UpArrowIcon({ color = "currentColor", size = 11 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V3M3 8l5-5 5 5" />
    </svg>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
