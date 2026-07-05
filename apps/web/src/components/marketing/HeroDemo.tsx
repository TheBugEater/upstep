"use client";

import { useEffect, useRef, useState } from "react";

/* Looping product demo: a ghost cursor opens the feedback widget, types a
 * message, submits it, the item lands in the board, votes roll in and the
 * list re-sorts, then the team ships the top item. Pure CSS transforms - 
 * every position change animates. */

const ROW_H = 62;

type Status = "OPEN" | "IN_PROGRESS" | "DONE";
type DemoItem = {
  id: number;
  title: string;
  type: "BUG" | "FEATURE";
  votes: number;
  status: Status;
  fresh?: boolean;
};

const INITIAL: DemoItem[] = [
  { id: 1, title: "Add dark mode to the dashboard", type: "FEATURE", votes: 128, status: "IN_PROGRESS" },
  { id: 2, title: "Export feedback to CSV", type: "FEATURE", votes: 97, status: "OPEN" },
  { id: 3, title: "Slack alerts for new feedback", type: "FEATURE", votes: 64, status: "OPEN" },
  { id: 4, title: "Login button overlaps on iPhone SE", type: "BUG", votes: 41, status: "DONE" },
];

const SUBMISSIONS = [
  { text: "The save button disappears on mobile 😅", title: "Save button disappears on mobile", type: "BUG" as const },
  { text: "Would love keyboard shortcuts for triage!", title: "Keyboard shortcuts for triage", type: "FEATURE" as const },
];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-warning/10 text-warning border-warning/30" },
  IN_PROGRESS: { label: "In progress", cls: "bg-info/10 text-info border-info/25" },
  DONE: { label: "Done", cls: "bg-success/10 text-success border-success/30" },
};

class Stopped extends Error {}

export function HeroDemo() {
  const [items, setItems] = useState<DemoItem[]>(INITIAL);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedType, setTypedType] = useState<"BUG" | "FEATURE">("BUG");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 82, y: 92, shown: false });
  const [clickAt, setClickAt] = useState(0); // timestamp key → replays ring
  const [votePop, setVotePop] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const widgetBtnRef = useRef<HTMLButtonElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const voteRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const alive = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    alive.current = true;

    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => (alive.current ? resolve() : reject(new Stopped())), ms)
      );

    /** Center of an element in % of the demo container, so the cursor
     *  stays glued to targets across breakpoints. */
    const moveTo = async (el: Element | null | undefined, settle = 700) => {
      const root = rootRef.current;
      if (!root || !el) return;
      const r = root.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      setCursor({
        x: ((t.left + t.width / 2 - r.left) / r.width) * 100,
        y: ((t.top + t.height / 2 - r.top) / r.height) * 100,
        shown: true,
      });
      await sleep(settle);
    };

    const click = async () => {
      setClickAt(Date.now());
      await sleep(260);
    };

    async function run() {
      let round = 0;
      // Let the hero settle before the show starts
      await sleep(1400);
      for (;;) {
        const submission = SUBMISSIONS[round % SUBMISSIONS.length]!;

        // 1 - visitor opens the widget and types feedback
        await moveTo(widgetBtnRef.current);
        await click();
        setTypedType(submission.type);
        setWidgetOpen(true);
        await sleep(550);
        for (let i = 1; i <= submission.text.length; i++) {
          setTyped(submission.text.slice(0, i));
          await sleep(24 + Math.random() * 40);
        }
        await sleep(350);

        // 2 - send it: widget closes, card drops into the board
        await moveTo(sendBtnRef.current, 600);
        await click();
        setSending(true);
        await sleep(420);
        setWidgetOpen(false);
        setSending(false);
        setTyped("");
        const freshId = 100 + round;
        setItems((prev) => [
          ...prev.map((it) => ({ ...it, fresh: false })),
          { id: freshId, title: submission.title, type: submission.type, votes: 1, status: "OPEN" as Status, fresh: true },
        ]);
        setToast("New feedback received");
        await sleep(1300);
        setToast(null);

        // 3 - votes roll in one rank at a time; each burst clears the next
        // item up the board, so the counter climbs slowly and the card
        // visibly overtakes its neighbor instead of teleporting to the top.
        const target = freshId;
        for (const jump of [45, 20, 35, 30]) {
          await moveTo(voteRefs.current.get(target), 500);
          await click();
          setVotePop(target);
          setItems((prev) =>
            prev.map((it) => (it.id === target ? { ...it, votes: it.votes + jump } : it))
          );
          await sleep(950);
          setVotePop(null);
          await sleep(300);
        }
        await sleep(700);

        // 4 - the team triages it, then ships it
        setItems((prev) =>
          prev.map((it) => (it.id === target ? { ...it, status: "IN_PROGRESS" } : it))
        );
        await sleep(1400);
        setItems((prev) =>
          prev.map((it) => (it.id === target ? { ...it, status: "DONE" } : it))
        );
        setToast("Shipped 🎉");
        await sleep(1500);
        setToast(null);
        setCursor((c) => ({ ...c, shown: false }));
        await sleep(900);

        // 5 - reset for the next loop
        setItems(INITIAL);
        round++;
        await sleep(1200);
      }
    }

    run().catch((e) => {
      if (!(e instanceof Stopped)) throw e;
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const sorted = [...items].sort((a, b) => b.votes - a.votes);

  return (
    <div ref={rootRef} className="relative select-none" aria-hidden>
      {/* Board card */}
      <div className="rounded-2xl border border-line bg-card shadow-lift overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-line">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-clay/10 text-clay flex items-center justify-center text-sm">▤</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink">Mobile App</div>
              <div className="text-[11px] text-faint">Feedback board · sorted by votes</div>
            </div>
          </div>
          <span className="relative inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-success animate-pulse-ring" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>

        {/* Rows - absolutely positioned so re-sorting glides */}
        <div className="relative m-2.5" style={{ height: sorted.length * ROW_H }}>
          {sorted.map((it, idx) => (
            <div
              key={it.id}
              className={`absolute inset-x-0 transition-transform duration-500 ease-fluid ${
                it.fresh ? "animate-card-in" : ""
              }`}
              style={{
                transform: `translateY(${idx * ROW_H}px)`,
                height: ROW_H,
                // Lift the row that's actively climbing above its neighbors so
                // the two labels don't paint on top of each other mid-transit.
                zIndex: votePop === it.id ? 10 : 1,
              }}
            >
              <div
                className={`flex items-center gap-3 mx-1 h-[54px] px-3 rounded-xl border transition-all duration-300 ${
                  votePop === it.id
                    ? "border-clay/40 bg-clay-tint shadow-glow"
                    : "border-line bg-card hover:bg-surface/60"
                }`}
              >
                <div
                  ref={(el) => {
                    if (el) voteRefs.current.set(it.id, el);
                  }}
                  className={`flex flex-col items-center justify-center w-10 shrink-0 rounded-lg border py-1 transition-colors duration-300 ${
                    votePop === it.id
                      ? "border-clay/50 bg-clay/10"
                      : "border-line bg-surface/60"
                  }`}
                >
                  <span className="text-clay text-[10px] leading-none">▲</span>
                  <span className="text-[13px] font-semibold text-ink leading-tight tabular-nums">
                    <VoteCounter value={it.votes} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{it.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-px rounded-full border ${
                        it.type === "BUG"
                          ? "bg-danger/10 text-danger border-danger/25"
                          : "bg-info/10 text-info border-info/25"
                      }`}
                    >
                      {it.type === "BUG" ? "Bug" : "Feature"}
                    </span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-px rounded-full border transition-colors duration-500 ${STATUS_META[it.status].cls}`}
                    >
                      {STATUS_META[it.status].label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 -top-4 transition-all duration-400 ease-spring ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-fg text-xs font-medium px-3.5 py-1.5 shadow-lift whitespace-nowrap">
          {toast ?? "·"}
        </span>
      </div>

      {/* Floating feedback widget */}
      <div className="absolute -bottom-6 -right-3 sm:-right-6 flex flex-col items-end gap-3">
        <div
          className={`w-72 rounded-2xl border border-line bg-card shadow-lift p-4 origin-bottom-right transition-all duration-300 ease-spring ${
            widgetOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-3 pointer-events-none"
          }`}
        >
          <p className="text-xs font-semibold text-ink">Send feedback</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition ${
                typedType === "BUG"
                  ? "bg-danger/10 text-danger border-danger/25"
                  : "bg-surface text-muted border-line"
              }`}
            >
              Bug
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition ${
                typedType === "FEATURE"
                  ? "bg-info/10 text-info border-info/25"
                  : "bg-surface text-muted border-line"
              }`}
            >
              Idea
            </span>
          </div>
          <div className="mt-2.5 min-h-[64px] rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs text-ink leading-relaxed">
            {typed}
            <span className="inline-block w-px h-3.5 bg-clay align-middle ml-px animate-blink" />
          </div>
          <button
            ref={sendBtnRef}
            tabIndex={-1}
            className={`mt-3 w-full rounded-xl py-2 text-xs font-semibold text-white transition ${
              sending ? "bg-clay-hover" : "bg-clay"
            }`}
          >
            {sending ? "Sending…" : "Send feedback"}
          </button>
        </div>

        <button
          ref={widgetBtnRef}
          tabIndex={-1}
          className={`w-12 h-12 rounded-full bg-clay text-white shadow-lift flex items-center justify-center text-lg transition-transform duration-300 ease-spring ${
            widgetOpen ? "rotate-45 scale-95" : ""
          }`}
        >
          {widgetOpen ? "+" : "💬"}
        </button>
      </div>

      {/* Ghost cursor */}
      <div
        className="absolute z-10 pointer-events-none transition-all duration-700 ease-fluid"
        style={{
          left: `${cursor.x}%`,
          top: `${cursor.y}%`,
          opacity: cursor.shown ? 1 : 0,
        }}
      >
        <span key={clickAt} className={clickAt ? "absolute -inset-2 rounded-full bg-clay/30 animate-pop" : "hidden"} />
        <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-md relative">
          <path
            d="M4 2l12 6.5-5.2 1.6L8 16z"
            fill="rgb(var(--c-ink))"
            stroke="rgb(var(--c-canvas))"
            strokeWidth="1.4"
          />
        </svg>
      </div>
    </div>
  );
}

/** Tweens its displayed number up to `value` instead of snapping, so a vote
 *  burst reads as a count climbing rather than a number teleporting. */
export function VoteCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (displayRef.current === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    const to = value;
    const duration = 650;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{display}</>;
}
