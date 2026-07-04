"use client";

import { useEffect, useRef, useState } from "react";

/* Feature bento: pointer-tracked 3D tilt cards around an animated scene of a
 * human and an AI agent working the same project without stepping on each
 * other. The public board stays clean; agent busywork lands as Dev-only. */

const AGENTS = ["Claude Code", "Cursor", "Windsurf", "Copilot", "Gemini CLI"];

export function FeatureCards() {
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

      <div className="mt-14 grid gap-4 lg:grid-cols-3" style={{ perspective: "1200px" }}>
        {/* Wide animated scene */}
        <TiltCard className="lg:col-span-2">
          <AgentFlowScene />
        </TiltCard>

        <TiltCard>
          <CardBody
            icon="✦"
            title="Any MCP client"
            body="If it speaks MCP, it can run your inbox: triage, tasks, replies, boards."
          >
            <AgentTicker />
          </CardBody>
        </TiltCard>

        <TiltCard>
          <CardBody
            icon="⚡"
            title="2-line integration"
            body="Install the package, paste your API key, and you're live. No backend to build, nothing to host."
          />
        </TiltCard>

        <TiltCard>
          <CardBody
            icon="▲"
            title="Voting that ranks itself"
            body="Anonymous or per-user votes with dedupe built in. Your roadmap sorts itself by demand."
          />
        </TiltCard>

        <TiltCard>
          <CardBody
            icon="◫"
            title="Fluid triage boards"
            body="Drag cards across custom columns, filter by type and label, and watch everything glide."
          />
        </TiltCard>
      </div>
    </section>
  );
}

/* ─── 3D tilt wrapper ────────────────────────────────────────────────────── */

function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
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

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`group relative rounded-2xl border border-line bg-card shadow-soft hover:shadow-lift hover:border-clay/25 transition-[box-shadow,border-color] duration-300 will-change-transform [transform-style:preserve-3d] ${className}`}
      style={{ transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s, border-color 0.3s" }}
    >
      <div ref={glareRef} className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300" />
      {children}
    </div>
  );
}

function CardBody({
  icon,
  title,
  body,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col p-6 [transform-style:preserve-3d]">
      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-clay/10 text-lg text-clay group-hover:bg-clay/15 transition"
        style={{ transform: "translateZ(32px)" }}
      >
        {icon}
      </div>
      <div style={{ transform: "translateZ(20px)" }}>
        <h3 className="mb-2 text-[17px] font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}

/* ─── Rotating agent names ───────────────────────────────────────────────── */

function AgentTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % AGENTS.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-auto pt-5" style={{ transform: "translateZ(26px)" }}>
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink-soft">
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-pulse-ring" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        <span key={idx} className="animate-card-in inline-block min-w-[88px]">
          {AGENTS[idx]}
        </span>
        <span className="text-faint">connected</span>
      </div>
    </div>
  );
}

/* ─── Animated scene: human + agent on one project ───────────────────────── */

type SceneStep = 0 | 1 | 2 | 3 | 4;
class Stopped extends Error {}

export function AgentFlowScene() {
  // 0 idle · 1 agent files Dev task · 2 agent replies to voters ·
  // 3 human drags card to Done · 4 agent ticks its own task
  const [step, setStep] = useState<SceneStep>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(2);
      return;
    }
    let alive = true;
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => (alive ? resolve() : reject(new Stopped())), ms)
      );
    (async () => {
      for (;;) {
        await sleep(1600);
        setStep(1);
        await sleep(2200);
        setStep(2);
        await sleep(2200);
        setStep(3);
        await sleep(2200);
        setStep(4);
        await sleep(2600);
        setStep(0);
      }
    })().catch((e) => {
      if (!(e instanceof Stopped)) throw e;
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col p-6 [transform-style:preserve-3d]" aria-hidden>
      {/* Header: the two actors */}
      <div className="flex items-center justify-between" style={{ transform: "translateZ(24px)" }}>
        <div>
          <h3 className="text-[17px] font-semibold text-ink">Your agent does the busywork</h3>
          <p className="mt-1 text-sm text-muted leading-relaxed max-w-sm">
            Dev-only tasks and separate agent boards stay internal. Users only
            ever see the public roadmap.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-clay text-white text-xs font-semibold ring-2 ring-card">You</span>
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-fg text-sm ring-2 ring-card transition-transform duration-300 ${
              step === 1 || step === 2 || step === 4 ? "scale-110" : ""
            }`}
          >
            ✦
          </span>
        </div>
      </div>

      {/* Two mini boards */}
      <div className="mt-5 grid grid-cols-2 gap-3" style={{ transform: "translateZ(14px)" }}>
        {/* Public board */}
        <MiniBoard label="User board" tone="public">
          <MiniCard
            title="Dark mode"
            badge={<Pill cls="bg-info/10 text-info border-info/25">Feature</Pill>}
            extra={
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-clay">
                ▲ <span key={step >= 2 ? 1 : 0} className="animate-pop inline-block">{step >= 2 ? 129 : 128}</span>
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

        {/* Internal board */}
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

      {/* Activity line */}
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
