"use client";

import { useEffect, useRef, useState } from "react";
import { VoteCounter } from "./HeroDemo";

/* Feature showcase: a single 3D stage that auto-rotates through five short
 * scenes, one per feature. Each scene sits at a depth offset from the active
 * one; when the active index advances, the front scene recedes into the
 * stack and the next one rises into focus, like flipping through cards
 * instead of everything sitting frozen behind a static grid. */

type SlideId = "agent" | "voting" | "triage" | "mcp" | "integration";

const SLIDES: { id: SlideId; icon: string; title: string; body: string }[] = [
  {
    id: "agent",
    icon: "◆",
    title: "You and your AI, working the same board",
    body: "Dev-only tasks and a separate agent board stay internal. Users only see the public roadmap.",
  },
  {
    id: "voting",
    icon: "▲",
    title: "Voting that ranks itself",
    body: "Anonymous or per-user votes with dedupe built in. Your roadmap sorts itself by demand.",
  },
  {
    id: "triage",
    icon: "◫",
    title: "Fluid triage boards",
    body: "Drag cards across custom columns, filter by type and label, and watch everything glide.",
  },
  {
    id: "mcp",
    icon: "✦",
    title: "Any MCP client",
    body: "If it speaks MCP, it can run your inbox: triage, tasks, replies, boards.",
  },
  {
    id: "integration",
    icon: "⚡",
    title: "2-line integration",
    body: "Install the package, paste your API key, and you're live. No backend to build, nothing to host.",
  },
];

const AGENTS = ["Claude Code", "Cursor", "Windsurf", "Copilot", "Gemini CLI"];
const SLIDE_MS = 5200;

export function FeatureCards() {
  const { active, goTo } = useCarousel(SLIDES.length, SLIDE_MS);

  return (
    <section id="features" className="max-w-6xl mx-auto px-6 py-24">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-clay">
          Everything you need
        </span>
        <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink">
          You and your AI, working the same board
        </h2>
        <p className="mt-4 text-muted leading-relaxed">
          Users report. You triage. Your agent handles the busywork. Upstep
          keeps the public board clean and the internal one honest.
        </p>
      </div>

      {/* Stage */}
      <div className="mt-14" style={{ perspective: "1400px" }}>
        <TiltCard>
          <div className="relative h-[300px] sm:h-[280px] [transform-style:preserve-3d]">
            {SLIDES.map((s, i) => {
              const offset = (i - active + SLIDES.length) % SLIDES.length;
              return (
                <div
                  key={s.id}
                  className="absolute inset-0 p-6"
                  style={sceneStyle(offset)}
                >
                  {s.id === "agent" && <AgentFlowScene active={offset === 0} />}
                  {s.id === "voting" && <VotingScene active={offset === 0} />}
                  {s.id === "triage" && <TriageScene active={offset === 0} />}
                  {s.id === "mcp" && <McpScene active={offset === 0} />}
                  {s.id === "integration" && <IntegrationScene active={offset === 0} />}
                </div>
              );
            })}
          </div>
        </TiltCard>
      </div>

      {/* Nav tiles double as feature legend */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {SLIDES.map((s, i) => (
          <TiltCard key={s.id} active={i === active} onClick={() => goTo(i)}>
            <div className="flex flex-col p-4">
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors duration-300 ${
                  i === active ? "bg-clay/15 text-clay" : "bg-clay/10 text-clay/70"
                }`}
                style={{ transform: "translateZ(20px)" }}
              >
                {s.icon}
              </div>
              <h3
                className={`text-[13px] font-semibold leading-snug transition-colors duration-300 ${
                  i === active ? "text-ink" : "text-ink-soft"
                }`}
                style={{ transform: "translateZ(12px)" }}
              >
                {s.title}
              </h3>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}

/* ─── Carousel state ─────────────────────────────────────────────────────── */

function useCarousel(len: number, intervalMs: number) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function restartTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reducedMotion.current) return;
    timerRef.current = setInterval(() => {
      setActive((a) => (a + 1) % len);
    }, intervalMs);
  }

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, intervalMs]);

  function goTo(i: number) {
    setActive(i);
    restartTimer();
  }

  return { active, goTo };
}

/** Depth position for a scene at `offset` steps behind the active one:
 *  0 = front and visible, 1 = next up, peeking behind, 2+ = out of view. */
// The outgoing (front -> hidden) and incoming (hidden -> front) scenes both
// sit at the same screen position, so animating them at the same time makes
// them crossfade through each other, muddy, half-legible text on top of
// other half-legible text. Splitting the transition into two beats (recede
// first, then a delayed rise) keeps them sequential instead: the 1st card
// visibly clears out before the 2nd one animates into its place.
function sceneStyle(offset: number): React.CSSProperties {
  if (offset === 0) {
    return {
      transform: "translateZ(0px) translateY(0px) scale(1) rotateX(0deg)",
      opacity: 1,
      zIndex: 3,
      pointerEvents: "auto",
      transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.24s, opacity 0.4s ease 0.24s",
    };
  }
  if (offset === 1) {
    return {
      transform: "translateZ(-50px) translateY(20px) scale(0.94) rotateX(6deg)",
      opacity: 0,
      zIndex: 2,
      pointerEvents: "none",
      transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1), opacity 0.28s ease",
    };
  }
  return {
    transform: "translateZ(-100px) translateY(30px) scale(0.9) rotateX(8deg)",
    opacity: 0,
    zIndex: 1,
    pointerEvents: "none",
    transition: "transform 0.32s ease, opacity 0.28s ease",
  };
}

/* ─── 3D tilt wrapper ────────────────────────────────────────────────────── */

function TiltCard({
  children,
  className = "",
  active,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 12}deg) translateZ(0)`;
      const glare = glareRef.current;
      if (glare) {
        glare.style.opacity = "1";
        glare.style.background = `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, rgb(var(--c-clay) / 0.09), transparent 65%)`;
      }
    });
  }

  function onLeave() {
    const el = ref.current;
    cancelAnimationFrame(frame.current);
    if (el) el.style.transform = "rotateX(0deg) rotateY(0deg)";
    if (glareRef.current) glareRef.current.style.opacity = "0";
  }

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      ref={ref as never}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`group relative w-full text-left rounded-2xl border bg-card shadow-soft hover:shadow-lift transition-[box-shadow,border-color] duration-300 will-change-transform [transform-style:preserve-3d] ${
        active ? "border-clay/40 shadow-lift" : "border-line hover:border-clay/25"
      } ${className}`}
      style={{ transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s, border-color 0.3s" }}
    >
      <div ref={glareRef} className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300" />
      {children}
    </Comp>
  );
}

/* ─── Scene: agent + human on one project ───────────────────────────────── */

type FlowStep = 0 | 1 | 2 | 3 | 4;
class Stopped extends Error {}

function useSceneLoop(active: boolean, run: (sleep: (ms: number) => Promise<void>) => Promise<void>) {
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => (alive ? resolve() : reject(new Stopped())), ms)
      );
    run(sleep).catch((e) => {
      if (!(e instanceof Stopped)) throw e;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

function AgentFlowScene({ active }: { active: boolean }) {
  const [step, setStep] = useState<FlowStep>(0);

  useEffect(() => {
    if (!active) setStep(0);
  }, [active]);

  useSceneLoop(active, async (sleep) => {
    for (;;) {
      await sleep(900);
      setStep(1);
      await sleep(1500);
      setStep(2);
      await sleep(1500);
      setStep(3);
      await sleep(1500);
      setStep(4);
      await sleep(1800);
      setStep(0);
      await sleep(600);
    }
  });

  return (
    <div className="relative flex h-full flex-col [transform-style:preserve-3d]" aria-hidden>
      <div className="absolute right-0 top-0 hidden sm:flex items-center -space-x-1.5" style={{ transform: "translateZ(28px)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay text-white text-[11px] font-semibold ring-2 ring-card">You</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-fg text-xs ring-2 ring-card transition-transform duration-300 ${
            step === 1 || step === 2 || step === 4 ? "scale-110" : ""
          }`}
        >
          ✦
        </span>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-3" style={{ transform: "translateZ(14px)" }}>
        <MiniBoard label="User board" tone="public">
          <MiniCard
            title="Dark mode"
            badge={<Pill cls="bg-info/10 text-info border-info/25">Feature</Pill>}
            extra={
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-clay">
                ▲ <VoteCounter value={step >= 2 ? 129 : 128} />
              </span>
            }
            highlight={step === 3}
            status={
              step >= 3 ? (
                <Pill cls="bg-success/10 text-success border-success/30">Done</Pill>
              ) : (
                <Pill cls="bg-warning/10 text-warning border-warning/30">Open</Pill>
              )
            }
          />
          <div
            className={`overflow-hidden transition-all duration-500 ease-fluid ${
              step >= 2 ? "max-h-10 opacity-100 mt-1.5" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex items-center gap-1.5 rounded-lg bg-surface/80 border border-line px-2.5 py-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-fg text-[9px]">✦</span>
              <span className="truncate text-[10px] text-muted">On it, shipping this sprint 🚀</span>
            </div>
          </div>
        </MiniBoard>

        <MiniBoard label="Agent board · internal" tone="internal">
          <div
            className={`transition-all duration-500 ease-spring ${
              step >= 1 ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
          >
            <MiniCard
              title="Refactor theme tokens"
              badge={<Pill cls="bg-violet-500/10 text-violet-500 border-violet-500/30">Dev</Pill>}
              status={
                step >= 4 ? (
                  <Pill cls="bg-success/10 text-success border-success/30">Done</Pill>
                ) : (
                  <Pill cls="bg-info/10 text-info border-info/25">Doing</Pill>
                )
              }
              highlight={step === 1 || step === 4}
            />
          </div>
          <div
            className={`mt-1.5 rounded-lg border border-dashed px-2.5 py-2 text-center text-[10px] transition-colors duration-500 ${
              step >= 1 ? "border-line text-faint" : "border-line-strong text-muted"
            }`}
          >
            {step >= 1 ? "hidden from users" : "agent workspace"}
          </div>
        </MiniBoard>
      </div>

      <div className="mt-4 flex items-center gap-2 min-h-[24px]" style={{ transform: "translateZ(18px)" }}>
        <span className="font-mono text-[11px] text-faint">
          {step === 0 && "listening for feedback…"}
          {step === 1 && <><Tool>create_feedback</Tool> internal: true</>}
          {step === 2 && <><Tool>add_comment</Tool> replying to 128 voters</>}
          {step === 3 && "you drag Dark mode to Done"}
          {step === 4 && <><Tool>update_feedback</Tool> status: "Done"</>}
        </span>
      </div>
    </div>
  );
}

function Tool({ children }: { children: React.ReactNode }) {
  return <span className="text-clay">⏺ {children}</span>;
}

function MiniBoard({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "public" | "internal";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        tone === "public" ? "border-line bg-surface/50" : "border-violet-500/20 bg-violet-500/[0.04]"
      }`}
    >
      <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </p>
      {children}
    </div>
  );
}

function MiniCard({
  title,
  badge,
  status,
  extra,
  highlight,
}: {
  title: string;
  badge: React.ReactNode;
  status: React.ReactNode;
  extra?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card px-2.5 py-2 shadow-soft transition-all duration-400 ${
        highlight ? "border-clay/40 shadow-lift -translate-y-0.5" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink">{title}</p>
        {extra}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {badge}
        {status}
      </div>
    </div>
  );
}

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border px-1.5 py-px text-[9px] font-semibold transition-colors duration-500 ${cls}`}>
      {children}
    </span>
  );
}

/* ─── Scene: voting climbs the board ─────────────────────────────────────── */

const VOTE_ROW_H = 46;

function VotingScene({ active }: { active: boolean }) {
  const initial = [
    { id: 1, title: "Slack alerts for new feedback", votes: 97 },
    { id: 2, title: "Export feedback to CSV", votes: 64 },
    { id: 3, title: "Keyboard shortcuts for triage", votes: 22 },
  ];
  const [items, setItems] = useState(initial);
  const [pop, setPop] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setItems(initial);
      setPop(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useSceneLoop(active, async (sleep) => {
    await sleep(1000);
    for (const jump of [30, 55]) {
      setPop(3);
      setItems((prev) => prev.map((it) => (it.id === 3 ? { ...it, votes: it.votes + jump } : it)));
      await sleep(1000);
      setPop(null);
      await sleep(500);
    }
    await sleep(1200);
    setItems(initial);
    await sleep(400);
  });

  const sorted = [...items].sort((a, b) => b.votes - a.votes);

  return (
    <div className="flex h-full flex-col justify-center [transform-style:preserve-3d]" aria-hidden>
      <div style={{ transform: "translateZ(16px)" }}>
        <div className="relative" style={{ height: sorted.length * VOTE_ROW_H }}>
          {sorted.map((it, idx) => (
            <div
              key={it.id}
              className="absolute inset-x-0 transition-transform duration-500 ease-fluid"
              style={{
                transform: `translateY(${idx * VOTE_ROW_H}px)`,
                height: VOTE_ROW_H,
                zIndex: pop === it.id ? 10 : 1,
              }}
            >
              <div
                className={`flex items-center gap-3 mx-0.5 h-10 px-3 rounded-xl border transition-all duration-300 ${
                  pop === it.id ? "border-clay/40 bg-clay-tint shadow-glow" : "border-line bg-card"
                }`}
              >
                <div
                  className={`flex flex-col items-center justify-center w-9 shrink-0 rounded-lg border py-0.5 transition-colors duration-300 ${
                    pop === it.id ? "border-clay/50 bg-clay/10" : "border-line bg-surface/60"
                  }`}
                >
                  <span className="text-clay text-[9px] leading-none">▲</span>
                  <span className="text-xs font-semibold text-ink leading-tight tabular-nums">
                    <VoteCounter value={it.votes} />
                  </span>
                </div>
                <p className="text-xs font-medium text-ink truncate">{it.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Scene: dragging a card to Done ─────────────────────────────────────── */

type DragStep = 0 | 1 | 2;

function TriageScene({ active }: { active: boolean }) {
  const [step, setStep] = useState<DragStep>(0);

  useEffect(() => {
    if (!active) setStep(0);
  }, [active]);

  useSceneLoop(active, async (sleep) => {
    await sleep(900);
    setStep(1);
    await sleep(700);
    setStep(2);
    await sleep(2400);
    setStep(0);
    await sleep(600);
  });

  const cardStyle: React.CSSProperties =
    step === 1
      ? { transform: "translate(78px, -10px) rotate(4deg) scale(1.04)", boxShadow: "var(--shadow-lift)" }
      : step === 2
      ? { transform: "translate(0, 0) rotate(0deg) scale(1)" }
      : { transform: "translate(0, 0) rotate(0deg) scale(1)" };

  return (
    <div className="flex h-full flex-col justify-center [transform-style:preserve-3d]" aria-hidden>
      <div className="grid grid-cols-2 gap-3" style={{ transform: "translateZ(16px)" }}>
        <div className="rounded-xl border border-line bg-surface/50 p-2.5 min-h-[110px]">
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Open</p>
          <div
            className="rounded-lg border border-line bg-card px-2.5 py-2 shadow-soft transition-all duration-500 ease-spring relative"
            style={{ ...cardStyle, opacity: step === 2 ? 0 : 1, zIndex: 10 }}
          >
            <p className="text-xs font-medium text-ink">Login button overlaps</p>
            <span className="mt-1.5 inline-block rounded-full border border-danger/25 bg-danger/10 text-danger px-1.5 py-px text-[9px] font-semibold">
              Bug
            </span>
          </div>
        </div>
        <div
          className={`rounded-xl border p-2.5 min-h-[110px] transition-colors duration-300 ${
            step >= 1 ? "border-clay/40 bg-clay-tint/40" : "border-line bg-surface/50"
          }`}
        >
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Done</p>
          <div
            className={`rounded-lg border bg-card px-2.5 py-2 shadow-soft transition-all duration-500 ${
              step === 2 ? "opacity-100 translate-y-0 border-success/30" : "opacity-0 -translate-y-2 border-line"
            }`}
          >
            <p className="text-xs font-medium text-ink">Login button overlaps</p>
            <span className="mt-1.5 inline-block rounded-full border border-success/25 bg-success/10 text-success px-1.5 py-px text-[9px] font-semibold">
              Done
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[11px] text-faint" style={{ transform: "translateZ(12px)" }}>
        {step === 0 && "drag to re-triage…"}
        {step === 1 && "moving to Done"}
        {step === 2 && "dropped ✓"}
      </p>
    </div>
  );
}

/* ─── Scene: MCP tool calls ──────────────────────────────────────────────── */

const MCP_LINES = [
  'list_feedback({ sort: "votes" })',
  '14 open · top: "Dark mode"',
  'update_feedback({ status: "Done" })',
  "128 voters notified",
];

function McpScene({ active }: { active: boolean }) {
  const [agentIdx, setAgentIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    if (!active) {
      setAgentIdx(0);
      setLineIdx(0);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setAgentIdx((i) => (i + 1) % AGENTS.length), 1800);
    return () => clearInterval(t);
  }, [active]);

  useSceneLoop(active, async (sleep) => {
    for (;;) {
      for (let i = 0; i < MCP_LINES.length; i++) {
        setLineIdx(i);
        await sleep(1000);
      }
      await sleep(600);
    }
  });

  return (
    <div className="flex h-full flex-col justify-center [transform-style:preserve-3d]" aria-hidden>
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink-soft" style={{ transform: "translateZ(22px)" }}>
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-pulse-ring" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        <span key={agentIdx} className="animate-card-in inline-block min-w-[88px]">
          {AGENTS[agentIdx]}
        </span>
        <span className="text-faint">connected</span>
      </div>

      <div className="mt-3 rounded-xl bg-[#1C1B19] p-3.5 font-mono text-[11px] leading-relaxed" style={{ transform: "translateZ(14px)" }}>
        {MCP_LINES.map((line, i) => (
          <p
            key={line}
            className={`transition-opacity duration-300 ${i <= lineIdx ? "opacity-100" : "opacity-0 h-0"}`}
          >
            {i % 2 === 0 ? <span className="text-[#F0A48A]">⏺ {line}</span> : <span className="text-white/45">⎿ {line}</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ─── Scene: two-line integration goes live ──────────────────────────────── */

const INTEGRATION_CODE = [
  'import { FeedbackWidget } from "@upstep/js/react"',
  "<FeedbackWidget apiKey=\"upstep_xxx\" />",
];

function IntegrationScene({ active }: { active: boolean }) {
  const [typed, setTyped] = useState(["", ""]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!active) {
      setTyped(["", ""]);
      setLive(false);
    }
  }, [active]);

  useSceneLoop(active, async (sleep) => {
    await sleep(700);
    for (let line = 0; line < INTEGRATION_CODE.length; line++) {
      const text = INTEGRATION_CODE[line]!;
      for (let i = 1; i <= text.length; i++) {
        setTyped((prev) => prev.map((t, idx) => (idx === line ? text.slice(0, i) : t)));
        await sleep(14);
      }
      await sleep(300);
    }
    await sleep(400);
    setLive(true);
    await sleep(2600);
    setLive(false);
    setTyped(["", ""]);
    await sleep(300);
  });

  return (
    <div className="flex h-full flex-col justify-center [transform-style:preserve-3d]" aria-hidden>
      <div className="rounded-xl border border-line-strong bg-[#1C1B19] overflow-hidden" style={{ transform: "translateZ(16px)" }}>
        <div className="flex items-center gap-2 px-3.5 h-9 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          <span className="ml-2 text-[10px] text-white/40 font-mono">App.tsx</span>
          <span
            className={`ml-auto inline-flex items-center gap-1 text-[10px] font-medium transition-opacity duration-500 ${
              live ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-pulse-ring" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-white/70">Live</span>
          </span>
        </div>
        <div className="px-4 py-3 font-mono text-[11.5px] leading-relaxed text-white/85 min-h-[64px]">
          <p className="text-white/50">{typed[0]}</p>
          <p>{typed[1]}</p>
        </div>
      </div>
    </div>
  );
}
