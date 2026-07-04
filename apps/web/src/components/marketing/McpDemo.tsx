"use client";

import { useEffect, useRef, useState } from "react";

/* Looping terminal demo: an AI agent triages the feedback inbox over MCP.
 * User lines type in, tool calls and results fade in. */

type Line =
  | { kind: "user"; text: string }
  | { kind: "tool"; text: string }
  | { kind: "result"; text: string }
  | { kind: "assistant"; text: string };

const SCRIPT: Line[] = [
  { kind: "user", text: "what should we build next?" },
  { kind: "tool", text: 'upstep · list_feedback({ sort: "votes" })' },
  { kind: "result", text: '14 open items · top: "Dark mode" with 128 votes' },
  { kind: "assistant", text: "Dark mode is the clear winner: 128 votes and climbing. Want me to put it on the board?" },
  { kind: "user", text: "yes, and track the refactor internally" },
  { kind: "tool", text: 'upstep · update_feedback({ id: "fb_8c21", status_name: "In progress" })' },
  { kind: "result", text: "Moved to In progress on the user board" },
  { kind: "tool", text: 'upstep · create_feedback({ title: "Refactor theme tokens", internal: true })' },
  { kind: "result", text: "Created as Dev-only · hidden from the public widget" },
  { kind: "tool", text: 'upstep · add_comment({ text: "On it, shipping this sprint 🚀" })' },
  { kind: "result", text: "Reply posted · 128 voters see the update" },
  { kind: "assistant", text: "Done. Users see Dark mode moving; the refactor task stays on your internal board." },
];

class Stopped extends Error {}

export function McpDemo() {
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const alive = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLines(SCRIPT);
      return;
    }
    alive.current = true;
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => (alive.current ? resolve() : reject(new Stopped())), ms)
      );

    async function run() {
      await sleep(800);
      for (;;) {
        setLines([]);
        for (const line of SCRIPT) {
          if (line.kind === "user") {
            setTyping("");
            await sleep(350);
            for (let i = 1; i <= line.text.length; i++) {
              setTyping(line.text.slice(0, i));
              await sleep(26 + Math.random() * 30);
            }
            await sleep(300);
            setTyping(null);
            setLines((prev) => [...prev, line]);
          } else {
            await sleep(line.kind === "tool" ? 650 : 450);
            setLines((prev) => [...prev, line]);
          }
        }
        await sleep(5000);
      }
    }

    run().catch((e) => {
      if (!(e instanceof Stopped)) throw e;
    });
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, typing]);

  return (
    <div className="rounded-2xl border border-line-strong bg-[#1C1B19] shadow-lift overflow-hidden" aria-hidden>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-xs text-white/40 font-mono">your agent ⇄ upstep mcp</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#28C840]" />
          connected
        </span>
      </div>

      <div ref={scrollRef} className="px-5 py-4 h-[340px] overflow-y-auto font-mono text-[12.5px] leading-relaxed space-y-2.5 scrollbar-none">
        {lines.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}
        {typing !== null && (
          <p className="text-white/90">
            <span className="text-[#E05A33] mr-2">›</span>
            {typing}
            <span className="inline-block w-[7px] h-3.5 bg-white/80 align-middle ml-0.5 animate-blink" />
          </p>
        )}
        {typing === null && lines.length === 0 && (
          <p className="text-white/30">
            <span className="text-[#E05A33] mr-2">›</span>
            <span className="inline-block w-[7px] h-3.5 bg-white/50 align-middle animate-blink" />
          </p>
        )}
      </div>
    </div>
  );
}

function TerminalLine({ line }: { line: Line }) {
  switch (line.kind) {
    case "user":
      return (
        <p className="text-white/90 animate-fade-in">
          <span className="text-[#E05A33] mr-2">›</span>
          {line.text}
        </p>
      );
    case "tool":
      return (
        <p className="text-white/85 animate-fade-in">
          <span className="text-[#E05A33] mr-2">⏺</span>
          <span className="text-[#F0A48A]">{line.text}</span>
        </p>
      );
    case "result":
      return (
        <p className="text-white/45 pl-5 animate-fade-in">
          <span className="mr-2">⎿</span>
          {line.text}
        </p>
      );
    case "assistant":
      return <p className="text-white/75 animate-fade-in pl-5">{line.text}</p>;
  }
}
