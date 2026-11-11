import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  Comment,
  Feedback,
  FeedbackType,
  FeedbackWithComments,
  UpstepColorOverrides,
  UpstepConfig,
} from "@upstep/types";
import { UpstepApiClient } from "./api";
import {
  DEFAULT_ACCENT,
  buildWidgetPalette,
  scaleRadius,
  withAlpha,
  type WidgetPalette,
} from "./theme";

const SYSTEM_FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

// ─── Theming ─────────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "auto";
type Palette = WidgetPalette;

/** Accent at a low opacity for selected fills. */
function tint(accent: string, alpha: number) {
  return (
    withAlpha(accent, alpha) ??
    `color-mix(in srgb, ${accent} ${Math.round(alpha * 100)}%, transparent)`
  );
}

/** Reads the `.dark` class / `data-theme="dark"` convention most apps toggle
 *  on <html> (Tailwind's `darkMode: "class"` and friends). Absence of that
 *  signal means light: these conventions are binary — a page that manages
 *  its own theme this way has already merged in its OS preference (usually
 *  at pre-paint, before hydration) by the time this runs, so re-checking
 *  prefers-color-scheme independently here would just re-introduce the
 *  mismatch instead of resolving it. */
function isHostDark(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return (
    root.classList.contains("dark") ||
    root.getAttribute("data-theme") === "dark"
  );
}

function usePalette(
  mode: ThemeMode,
  look: {
    accentColor: string | undefined;
    colors: UpstepColorOverrides | undefined;
    radius: number | undefined;
  },
): Palette {
  // Initial value must be SSR-safe (no `window`/`document` access) so it
  // matches the server-rendered markup exactly. React does not patch DOM
  // attributes that mismatch during hydration, so if this returned the real
  // client value here, the follow-up setState in the effect below (already
  // holding that same value) would be a no-op and the stale server markup
  // would stick forever.
  const [isDark, setIsDark] = useState(() => mode === "dark");

  useEffect(() => {
    if (mode !== "auto") {
      setIsDark(mode === "dark");
      return;
    }

    // "auto" follows the host page's own theme, not the OS preference — see
    // isHostDark() above. A class toggle fires no event, so watch it with a
    // MutationObserver rather than only checking once at mount.
    setIsDark(isHostDark());
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setIsDark(isHostDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, [mode]);

  const { accentColor, colors, radius } = look;
  return React.useMemo(
    () =>
      buildWidgetPalette({
        mode: isDark ? "dark" : "light",
        accentColor,
        colors,
        radius,
      }),
    // `colors` is usually an inline object literal, so compare it by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, accentColor, JSON.stringify(colors ?? null), radius],
  );
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface UpstepContextValue {
  client: UpstepApiClient;
  feedItems: Feedback[];
  loadFeed: () => Promise<void>;
  submit: (
    title: string,
    content: string,
    type?: FeedbackType,
  ) => Promise<void>;
  vote: (feedbackId: string, value: "UP" | "DOWN") => Promise<void>;
  getItem: (feedbackId: string) => Promise<FeedbackWithComments>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  identify: (userId: string | undefined) => void;
  /** The configured accent, or the light-mode default when none was set. */
  accentColor: string;
  /** The configured accent; undefined means each mode uses its brand default. */
  customAccentColor: string | undefined;
  theme: ThemeMode;
  colors: UpstepColorOverrides | undefined;
  radius: number | undefined;
  fontFamily: string | undefined;
  showBranding: boolean;
  chat: boolean;
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

  useEffect(() => {
    client.supportIdentityToken = config.supportIdentityToken;
    document
      .querySelectorAll<HTMLIFrameElement>("iframe[data-upstep-support]")
      .forEach((frame) =>
        frame.contentWindow?.postMessage(
          {
            type: "upstep:support:identity",
            token: config.supportIdentityToken,
          },
          new URL(client.baseUrl).origin,
        ),
      );
  }, [client, config.supportIdentityToken]);

  const loadFeed = useCallback(async () => {
    try {
      const data = await client.listFeedback({ sort: "votes", limit: 20 });
      setFeedItems(data.items);
      setShowBranding(data.showBranding ?? true);
    } catch {
      // non-critical — feed unavailable, widget stays mounted
    }
  }, [client]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const submit = useCallback(
    async (title: string, content: string, type?: FeedbackType) => {
      const payload: Parameters<typeof client.submitFeedback>[0] = { content };
      if (title.trim()) payload.title = title.trim();
      if (type !== undefined) payload.type = type;
      await client.submitFeedback(payload);
      await loadFeed();
    },
    [client, loadFeed],
  );

  const vote = useCallback(
    async (feedbackId: string, value: "UP" | "DOWN") => {
      try {
        await client.vote(feedbackId, value);
        await loadFeed();
      } catch {
        // vote failed silently
      }
    },
    [client, loadFeed],
  );

  const getItem = useCallback(
    (feedbackId: string) => client.getItem(feedbackId),
    [client],
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const identify = useCallback(
    (userId: string | undefined) => client.setUserId(userId),
    [client],
  );

  return (
    <UpstepContext.Provider
      value={{
        client,
        feedItems,
        loadFeed,
        submit,
        vote,
        getItem,
        isOpen,
        open,
        close,
        identify,
        accentColor: config.accentColor ?? DEFAULT_ACCENT,
        customAccentColor: config.accentColor,
        theme: config.theme ?? "auto",
        colors: config.colors,
        radius: config.radius,
        fontFamily: config.fontFamily,
        showBranding,
        chat: config.chat !== false,
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
  /** Override the provider's colors for this widget. */
  colors?: UpstepColorOverrides;
  /** Override the provider's corner radius for this widget. */
  radius?: number;
  /** Override the provider's font for this widget. */
  fontFamily?: string;
  hideLauncher?: boolean;
  /** Override chat visibility for this widget. Project/plan access still applies. */
  chat?: boolean;
}

type Screen = "list" | "detail" | "create" | "support";

export function FeedbackWidget({
  position = "bottom-right",
  accentColor,
  theme,
  colors,
  radius,
  fontFamily,
  hideLauncher = false,
  chat = true,
}: FeedbackWidgetProps) {
  const ctx = useUpstep();
  const p = usePalette(theme ?? ctx.theme, {
    accentColor: accentColor ?? ctx.customAccentColor,
    colors: colors ?? ctx.colors,
    radius: radius ?? ctx.radius,
  });
  const accent = p.accent;
  const appearance = {
    colors: colors ?? ctx.colors,
    radius: radius ?? ctx.radius,
    fontFamily: fontFamily ?? ctx.fontFamily,
  };
  const {
    isOpen: open,
    open: openWidget,
    close: closeWidget,
    showBranding,
  } = ctx;
  const [screen, setScreen] = useState<Screen>("list");
  const [hasSupport, setHasSupport] = useState(false);
  useEffect(() => {
    let active = true;
    ctx.client.chat = ctx.chat;
    if (!ctx.chat || !chat) {
      setHasSupport(false);
      return;
    }
    void ctx.client.supportEnabled().then((value) => {
      if (active) setHasSupport(value);
    });
    return () => {
      active = false;
    };
  }, [ctx.client, ctx.chat, chat]);
  useEffect(() => {
    if ((!ctx.chat || !chat) && screen === "support") setScreen("list");
  }, [ctx.chat, chat, screen]);
  useEffect(() => {
    if (open) setScreen(hasSupport && chat && ctx.chat ? "support" : "list");
  }, [open, hasSupport, chat, ctx.chat]);
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

  const posStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 24,
    right: 24,
  };

  const font = appearance.fontFamily?.trim() || SYSTEM_FONT;

  function handleClose() {
    closeWidget();
    setDetailId(null);
  }

  function goToDetail(id: string) {
    setDetailId(id);
    setScreen("detail");
  }

  return (
    <>
      {!hideLauncher && (
        <button
          aria-label="Open help and feedback"
          onClick={openWidget}
          style={{
            ...posStyle,
            zIndex: 9998,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: accent,
            color: p.accentText,
            border: "none",
            borderRadius: scaleRadius(9999, p.radius),
            padding: isMobile ? "12px" : "12px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: font,
            boxShadow: "0 6px 20px rgba(26,25,21,.18)",
          }}
        >
          <ChatIcon size={16} />
          {!isMobile &&
            (hasSupport && chat && ctx.chat ? "Help & feedback" : "Feedback")}
        </button>
      )}

      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: isMobile ? "0 12px 80px" : "0 24px 88px",
            fontFamily: font,
          }}
        >
          <div
            style={{
              background: p.bg,
              border: `1px solid ${p.border}`,
              borderRadius: scaleRadius(20, p.radius),
              width: "100%",
              maxWidth: hasSupport && chat && ctx.chat ? 460 : 440,
              maxHeight: "calc(100dvh - 112px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,.28)",
            }}
          >
            {/* Header */}
            {hasSupport && chat && ctx.chat ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 14px",
                  borderBottom: `1px solid ${p.border}`,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", flex: 1, gap: 4 }}>
                  {[
                    ["support", "Support"],
                    ["list", "Feedback"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setScreen(value as Screen)}
                      style={{
                        flex: 1,
                        border: 0,
                        borderRadius: scaleRadius(8, p.radius),
                        padding: "9px 12px",
                        background: (
                          screen === "support"
                            ? value === "support"
                            : value === "list"
                        )
                          ? p.bgSoft
                          : "transparent",
                        color: (
                          screen === "support"
                            ? value === "support"
                            : value === "list"
                        )
                          ? p.text
                          : p.textSoft,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  aria-label="Close"
                  onClick={handleClose}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: p.textSoft,
                    padding: 6,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: `1px solid ${p.border}`,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {screen !== "list" && (
                    <button
                      onClick={() => setScreen("list")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: accent,
                        fontSize: 14,
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  {screen === "list" && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: p.text,
                        letterSpacing: "-.01em",
                      }}
                    >
                      Feedback
                    </span>
                  )}
                  {screen === "create" && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: p.text,
                        letterSpacing: "-.01em",
                      }}
                    >
                      New feedback
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {screen === "list" && (
                    <button
                      onClick={() => setScreen("create")}
                      style={{
                        background: accent,
                        color: p.accentText,
                        border: "none",
                        borderRadius: scaleRadius(20, p.radius),
                        padding: "6px 14px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + New
                    </button>
                  )}
                  <button
                    onClick={handleClose}
                    style={{
                      background: p.bgSoft,
                      border: "none",
                      width: 28,
                      height: 28,
                      borderRadius: scaleRadius(8, p.radius),
                      fontSize: 14,
                      cursor: "pointer",
                      color: p.textSoft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: screen === "support" ? 0 : "16px 20px 24px",
              }}
            >
              {screen === "support" && chat && ctx.chat && (
                <SupportFrame
                  client={ctx.client}
                  accentColor={accent}
                  theme={p.dark ? "dark" : "light"}
                  appearance={appearance}
                />
              )}
              {hasSupport && chat && ctx.chat && screen !== "support" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  {screen === "list" ? (
                    <>
                      <span
                        style={{ fontSize: 14, fontWeight: 600, color: p.text }}
                      >
                        Feedback & ideas
                      </span>
                      <button
                        onClick={() => setScreen("create")}
                        style={{
                          border: 0,
                          borderRadius: scaleRadius(8, p.radius),
                          background: accent,
                          color: p.accentText,
                          fontSize: 14,
                          padding: "7px 10px",
                          cursor: "pointer",
                        }}
                      >
                        + New
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setScreen("list")}
                      style={{
                        border: 0,
                        background: "none",
                        padding: 0,
                        color: p.textSoft,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      ← Back to feedback
                    </button>
                  )}
                </div>
              )}
              {screen === "list" && (
                <FeedList onSelect={goToDetail} accent={accent} p={p} />
              )}
              {screen === "detail" && detailId && (
                <FeedDetail
                  feedbackId={detailId}
                  accent={accent}
                  p={p}
                  font={font}
                />
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
            {showBranding && screen !== "support" && (
              <a
                href="https://upstep.dev"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "8px 0",
                  borderTop: `1px solid ${p.border}`,
                  fontSize: 11,
                  color: p.textFaint,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                Powered by{" "}
                <strong style={{ fontWeight: 700 }}>Upstep.dev</strong>
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SupportFrame({
  client,
  theme,
  accentColor,
  appearance,
}: {
  client: UpstepApiClient;
  theme: string;
  accentColor: string;
  appearance: Parameters<UpstepApiClient["supportFrameUrl"]>[2];
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (ref.current) return client.connectSupportFrame(ref.current);
  }, [client]);
  return (
    <iframe
      ref={ref}
      data-upstep-support
      title="Customer support"
      src={client.supportFrameUrl(theme, accentColor, appearance)}
      style={{
        color: accentColor,
        width: "100%",
        height: "min(560px, calc(100dvh - 168px))",
        minHeight: 300,
        border: 0,
        display: "block",
      }}
    />
  );
}

// ─── FeedList ─────────────────────────────────────────────────────────────────

function FeedList({
  onSelect,
  accent,
  p,
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
        <div
          style={{
            color: p.textSoft,
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
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
              display: "flex",
              gap: 12,
              padding: 14,
              border: `1px solid ${p.border}`,
              borderRadius: scaleRadius(14, p.radius),
              marginBottom: 10,
              background: p.bg,
              cursor: "pointer",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                vote(f.id, "UP");
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                minWidth: 46,
                padding: "7px 0",
                borderRadius: scaleRadius(11, p.radius),
                cursor: "pointer",
                flexShrink: 0,
                border: `1px solid ${voted ? accent : p.border}`,
                background: voted ? p.accentTint : p.bgSoft,
              }}
            >
              <UpArrowIcon color={accent} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: p.text,
                  lineHeight: 1.1,
                }}
              >
                {f.upvotes}
              </span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: p.text,
                  margin: "0 0 6px",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                {title}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <TypeBadge type={f.type} p={p} />
                {f.status === "PENDING" ? (
                  <PendingBadge />
                ) : (
                  <StatusBadge
                    status={f.status}
                    boardStatus={f.boardStatus}
                    p={p}
                  />
                )}
                <span style={{ fontSize: 11, color: p.textFaint }}>
                  {fmtDate(f.createdAt)}
                </span>
              </div>
            </div>
            <span
              style={{
                color: p.textFaint,
                fontSize: 18,
                alignSelf: "center",
                flexShrink: 0,
              }}
            >
              ›
            </span>
          </div>
        );
      })}
    </>
  );
}

// ─── FeedDetail ───────────────────────────────────────────────────────────────

function FeedDetail({
  feedbackId,
  accent,
  p,
  font,
}: {
  feedbackId: string;
  accent: string;
  p: Palette;
  font: string;
}) {
  const { vote, getItem } = useUpstep();
  const [item, setItem] = useState<FeedbackWithComments | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getItem(feedbackId)
      .then((d) => {
        if (!cancelled) setItem(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          color: p.textFaint,
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  const title = item.title;

  return (
    <div>
      {title && (
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: p.text,
            letterSpacing: "-.02em",
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}
      >
        <TypeBadge type={item.type} p={p} />
        {item.status === "PENDING" ? (
          <PendingBadge />
        ) : (
          <StatusBadge
            status={item.status}
            boardStatus={item.boardStatus}
            p={p}
          />
        )}
      </div>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: p.textSoft,
          marginBottom: 20,
        }}
      >
        {item.content}
      </p>

      <button
        onClick={handleVote}
        disabled={voting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${item.userVote === "UP" ? accent : p.border}`,
          background: item.userVote === "UP" ? tint(accent, 0.08) : p.bgSoft,
          borderRadius: scaleRadius(12, p.radius),
          padding: "10px 16px",
          cursor: "pointer",
          fontFamily: font,
        }}
      >
        <UpArrowIcon color={accent} size={13} />
        <span style={{ fontSize: 18, fontWeight: 700, color: p.text }}>
          {item.upvotes}
        </span>
        <span style={{ fontSize: 14, color: p.textFaint }}>
          {item.userVote === "UP" ? "Upvoted" : "Upvote"}
        </span>
      </button>

      {item.comments.length > 0 && (
        <div
          style={{
            marginTop: 28,
            borderTop: `1px solid ${p.border}`,
            paddingTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".08em",
              color: p.textFaint,
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Comments
          </div>
          {item.comments.map((c: Comment) => (
            <CommentBubble key={c.id} comment={c} p={p} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBubble({
  comment,
  p,
  accent,
}: {
  comment: Comment;
  p: Palette;
  accent: string;
}) {
  return (
    <div
      style={{
        background: p.bgSoft,
        border: `1px solid ${p.border}`,
        borderRadius: scaleRadius(12, p.radius),
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            background: tint(accent, 0.125),
            color: accent,
            fontSize: 11,
            fontWeight: 700,
            borderRadius: scaleRadius(20, p.radius),
            padding: "2px 8px",
          }}
        >
          {comment.authorName?.trim() || "UpStep Team"}
        </span>
        <span style={{ fontSize: 11, color: p.textFaint }}>
          {fmtDate(comment.createdAt)}
        </span>
      </div>
      <p
        style={{ fontSize: 16, lineHeight: 1.6, color: p.textSoft, margin: 0 }}
      >
        {comment.content}
      </p>
    </div>
  );
}

// ─── CreateForm ───────────────────────────────────────────────────────────────

function CreateForm({
  accent,
  p,
  font,
  onDone,
}: {
  accent: string;
  p: Palette;
  font: string;
  onDone: () => void;
}) {
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
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: p.text,
            marginBottom: 6,
          }}
        >
          Submitted
        </div>
        <div style={{ fontSize: 14, color: p.textFaint }}>
          Feedback received. Thank you.
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${p.border}`,
    borderRadius: scaleRadius(12, p.radius),
    padding: "10px 12px",
    fontSize: 16,
    lineHeight: 1.6,
    outline: "none",
    background: p.bgSoft,
    color: p.text,
    fontFamily: font,
    boxSizing: "border-box",
  };

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".08em",
          color: p.textFaint,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        Type
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        {(["BUG", "FEATURE", "GENERAL"] as FeedbackType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "8px 10px",
              borderRadius: scaleRadius(9, p.radius),
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: type === t ? accent : p.bg,
              color: type === t ? p.accentText : p.textSoft,
              border: `1px solid ${type === t ? accent : p.border}`,
              fontFamily: font,
            }}
          >
            {TYPE_META[t].icon}
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".08em",
          color: p.textFaint,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        Title
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short summary of the issue or idea"
        maxLength={200}
        style={{ ...inputStyle, marginBottom: 16, display: "block" }}
      />

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".08em",
          color: p.textFaint,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        Description{" "}
        <span
          style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}
        >
          (optional)
        </span>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Steps to reproduce, expected behaviour, or more context"
        maxLength={2000}
        rows={4}
        style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
      />

      {error && (
        <p style={{ fontSize: 14, color: "#d6453d", marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !title.trim()}
        style={{
          width: "100%",
          padding: 12,
          background: accent,
          color: p.accentText,
          border: "none",
          borderRadius: scaleRadius(11, p.radius),
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          opacity: loading || !title.trim() ? 0.5 : 1,
          fontFamily: font,
        }}
      >
        {loading ? "Submitting…" : "Submit feedback"}
      </button>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const TYPE_META: Record<
  FeedbackType,
  { icon: React.ReactNode; label: string }
> = {
  BUG: {
    label: "Bug",
    icon: (
      <svg
        width={12}
        height={12}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="8" cy="10" rx="3.5" ry="4.5" />
        <path d="M8 5.5V4M5.5 6.5 3.5 5M10.5 6.5 12.5 5M4.5 10.5 2.5 10M11.5 10.5 13.5 10" />
      </svg>
    ),
  },
  FEATURE: {
    label: "Feature",
    icon: (
      <svg
        width={12}
        height={12}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1" />
        <circle cx="8" cy="8" r="2.5" />
      </svg>
    ),
  },
  GENERAL: {
    label: "General",
    icon: (
      <svg
        width={12}
        height={12}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 9a2 2 0 0 1-2 2H5L2 14V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5z" />
      </svg>
    ),
  },
};

const TYPE_BG: Record<string, string> = { BUG: "#fdecec", FEATURE: "#e9f0fd" };
const TYPE_FG: Record<string, string> = { BUG: "#d6453d", FEATURE: "#3b76d6" };

function TypeBadge({ type, p }: { type: FeedbackType; p: Palette }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: scaleRadius(9999, p.radius),
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".02em",
        background: TYPE_BG[type] ?? p.bgSoft,
        color: TYPE_FG[type] ?? p.textSoft,
      }}
    >
      {type}
    </span>
  );
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#b45309",
  IN_PROGRESS: "#1d4ed8",
  DONE: "#15803d",
  CLOSED: "#6b7280",
};

function PendingBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: 6,
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
        color: "#ea580c",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#ea580c",
          display: "inline-block",
        }}
      />
      Pending review
    </span>
  );
}

function StatusBadge({
  status,
  boardStatus,
  p,
}: {
  status: string;
  boardStatus: Feedback["boardStatus"];
  p: Palette;
}) {
  const color = boardStatus?.color ?? STATUS_COLOR[status] ?? "#9ca3af";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: p.bgSoft,
        border: `1px solid ${p.border}`,
        borderRadius: scaleRadius(6, p.radius),
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        color: p.textSoft,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {boardStatus?.name ?? status.replace("_", " ")}
    </span>
  );
}

function ChatIcon({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UpArrowIcon({
  color = "currentColor",
  size = 11,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13V3M3 8l5-5 5 5" />
    </svg>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
