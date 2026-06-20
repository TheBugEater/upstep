import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Feedback, FeedbackType, UpstepConfig } from "@upstep/types";
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

function usePalette(mode: ThemeMode): Palette {
  const [isDark, setIsDark] = useState(() => {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (mode !== "auto" || typeof window === "undefined" || !window.matchMedia) {
      setIsDark(mode === "dark");
      return;
    }
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
  submit: (content: string, type?: FeedbackType) => Promise<void>;
  vote: (feedbackId: string, value: "UP" | "DOWN") => Promise<void>;
  /** Whether the feedback modal is currently open. */
  isOpen: boolean;
  /** Open the feedback modal — call from your own UI (settings, menu, etc.). */
  open: () => void;
  /** Close the feedback modal. */
  close: () => void;
  /** Set / update the end-user id at runtime (e.g. after the user logs in). */
  identify: (userId: string | undefined) => void;
  /** Accent color from provider config (default applied). */
  accentColor: string;
  /** Theme mode from provider config (default "auto"). */
  theme: ThemeMode;
}

const UpstepContext = createContext<UpstepContextValue | null>(null);

export function UpstepProvider({
  children,
  ...config
}: UpstepConfig & { children: ReactNode }) {
  const [client] = useState(() => new UpstepApiClient(config));
  const [feedItems, setFeedItems] = useState<Feedback[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    client.setUserId(config.userId);
  }, [client, config.userId]);

  const loadFeed = useCallback(async () => {
    const data = await client.listFeedback({ sort: "votes", limit: 20 });
    setFeedItems(data.items);
  }, [client]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const submit = useCallback(async (content: string, type?: FeedbackType) => {
    const payload: Parameters<typeof client.submitFeedback>[0] = { content };
    if (type !== undefined) payload.type = type;
    await client.submitFeedback(payload);
    await loadFeed();
  }, [client, loadFeed]);

  const vote = useCallback(async (feedbackId: string, value: "UP" | "DOWN") => {
    await client.vote(feedbackId, value);
    await loadFeed();
  }, [client, loadFeed]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const identify = useCallback((userId: string | undefined) => client.setUserId(userId), [client]);

  return (
    <UpstepContext.Provider
      value={{
        client, feedItems, loadFeed, submit, vote, isOpen, open, close, identify,
        accentColor: config.accentColor ?? DEFAULT_ACCENT,
        theme: config.theme ?? "auto",
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

// ─── FeedbackWidget component ─────────────────────────────────────────────────

interface FeedbackWidgetProps {
  /** Position of the trigger button */
  position?: "bottom-right" | "bottom-left";
  /** Accent color. Defaults to the provider's accentColor (or "#D97757"). */
  accentColor?: string;
  /** Theme. Defaults to the provider's theme (or "auto"). */
  theme?: ThemeMode;
  /**
   * Hide the floating launcher button and only show the modal when opened
   * programmatically via `useUpstep().open()` — e.g. from a settings menu.
   */
  hideLauncher?: boolean;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: "🐞 Bug", FEATURE: "✨ Feature", GENERAL: "💬 General",
};

export function FeedbackWidget({
  position = "bottom-right",
  accentColor,
  theme,
  hideLauncher = false,
}: FeedbackWidgetProps) {
  const ctx = useUpstep();
  const accent = accentColor ?? ctx.accentColor;
  const p = usePalette(theme ?? ctx.theme);
  const { feedItems, submit, vote, isOpen: open, open: openWidget, close: closeWidget } = ctx;
  const [tab, setTab] = useState<"submit" | "feed">("submit");
  const [content, setContent] = useState("");
  const [type, setType] = useState<FeedbackType>("GENERAL");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const posStyle: React.CSSProperties =
    position === "bottom-left"
      ? { position: "fixed", bottom: 24, left: 24 }
      : { position: "fixed", bottom: 24, right: 24 };

  async function handleSubmit() {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      await submit(content.trim(), type);
      setContent("");
      setMsg("Thanks — we got your feedback! 🎉");
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const font = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

  return (
    <>
      {!hideLauncher && (
        <button
          onClick={openWidget}
          style={{
            ...posStyle, zIndex: 9998, display: "inline-flex", alignItems: "center", gap: 7,
            background: accent, color: "#fff", border: "none", borderRadius: 9999,
            padding: "12px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: font, boxShadow: "0 6px 20px rgba(26,25,21,.18)",
          }}
        >
          <ChatIcon /> Feedback
        </button>
      )}

      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && closeWidget()}
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 20px 0" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: p.text, letterSpacing: "-.01em" }}>Share your feedback</div>
                <div style={{ fontSize: 12.5, color: p.textFaint, marginTop: 2 }}>Tell us what to build next, or vote on ideas.</div>
              </div>
              <button
                onClick={closeWidget}
                style={{ background: p.bgSoft, border: "none", width: 28, height: 28, borderRadius: 8, fontSize: 14, cursor: "pointer", color: p.textSoft, display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>

            {/* Segmented tabs */}
            <div style={{ display: "flex", gap: 4, margin: "16px 20px 0", padding: 4, background: p.bgSoft, borderRadius: 11 }}>
              {(["submit", "feed"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: 8, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: tab === t ? p.bg : "transparent",
                    color: tab === t ? p.text : p.textSoft,
                    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                  }}
                >
                  {t === "submit" ? "Give feedback" : "Vote on ideas"}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 22px" }}>
              {tab === "submit" ? (
                <div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's on your mind?"
                    maxLength={2000}
                    style={{
                      width: "100%", minHeight: 104, border: `1px solid ${p.border}`, borderRadius: 12,
                      padding: 12, fontSize: 14, lineHeight: 1.5, resize: "vertical", outline: "none",
                      background: p.bgSoft, color: p.text, fontFamily: font,
                    }}
                  />
                  <div style={{ display: "flex", gap: 7, margin: "12px 0 4px" }}>
                    {(["BUG", "FEATURE", "GENERAL"] as FeedbackType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        style={{
                          flex: 1, padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                          background: type === t ? accent : p.bg,
                          color: type === t ? "#fff" : p.textSoft,
                          border: `1px solid ${type === t ? accent : p.border}`,
                        }}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !content.trim()}
                    style={{
                      width: "100%", padding: 12, background: accent, color: "#fff", border: "none",
                      borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 14,
                      opacity: loading || !content.trim() ? 0.5 : 1,
                    }}
                  >
                    {loading ? "Sending…" : "Send feedback"}
                  </button>
                  {msg && <p style={{ textAlign: "center", fontSize: 13, color: accent, fontWeight: 500, marginTop: 12 }}>{msg}</p>}
                </div>
              ) : (
                <FeedList items={feedItems} onVote={vote} accent={accent} p={p} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const BADGE_BG: Record<string, string> = { BUG: "#fdecec", FEATURE: "#e9f0fd", GENERAL: "" };
const BADGE_FG: Record<string, string> = { BUG: "#d6453d", FEATURE: "#3b76d6", GENERAL: "" };

function FeedList({
  items, onVote, accent, p,
}: {
  items: Feedback[];
  onVote: (id: string, v: "UP" | "DOWN") => void;
  accent: string;
  p: Palette;
}) {
  if (!items.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ color: p.textSoft, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No ideas yet</div>
        <div style={{ color: p.textFaint, fontSize: 14 }}>Be the first to share one.</div>
      </div>
    );
  }

  return (
    <>
      {items.map((f) => {
        const voted = f.userVote === "UP";
        return (
          <div key={f.id} style={{ display: "flex", gap: 12, padding: 14, border: `1px solid ${p.border}`, borderRadius: 14, marginBottom: 10, background: p.bg }}>
            <button
              onClick={() => onVote(f.id, "UP")}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                minWidth: 46, padding: "7px 0", borderRadius: 11, cursor: "pointer",
                border: `1px solid ${voted ? accent : p.border}`,
                background: voted ? `${accent}1a` : p.bgSoft,
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1, color: accent }}>▲</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: p.text, lineHeight: 1.1 }}>{f.upvotes}</span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: p.text, margin: "0 0 8px", wordBreak: "break-word" }}>{f.content}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 9999, fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em",
                  background: BADGE_BG[f.type] || p.bgSoft,
                  color: BADGE_FG[f.type] || p.textSoft,
                }}>
                  {f.type}
                </span>
                <span style={{ fontSize: 11, color: p.textFaint }}>{new Date(f.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
