"use client";

import { useMemo, useState } from "react";

type Lane = "Now" | "Next" | "Later";
type Item = { id: number; lane: Lane; title: string };
const LANES: Lane[] = ["Now", "Next", "Later"];

export function RoadmapBuilder() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, lane: "Now", title: "Improve onboarding" },
    { id: 2, lane: "Next", title: "Team permissions" },
    { id: 3, lane: "Later", title: "Mobile application" },
  ]);
  const [copied, setCopied] = useState(false);
  const markdown = useMemo(() => LANES.map((lane) => `## ${lane}\n${items.filter((i) => i.lane === lane).map((i) => `- ${i.title}`).join("\n") || "- Nothing planned yet"}`).join("\n\n"), [items]);

  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-soft">
      <div className="grid md:grid-cols-3 gap-3">
        {LANES.map((lane) => (
          <section key={lane} className="rounded-xl border border-line bg-surface/40 p-3">
            <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-ink">{lane}</h2><span className="text-[10px] text-faint">{items.filter((i) => i.lane === lane).length} items</span></div>
            <div className="space-y-2">
              {items.filter((i) => i.lane === lane).map((item) => (
                <div key={item.id} className="group flex gap-2 rounded-lg border border-line bg-card p-2">
                  <input value={item.title} aria-label={`${lane} roadmap item`} onChange={(e) => setItems((all) => all.map((i) => i.id === item.id ? { ...i, title: e.target.value } : i))} className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none" />
                  <button onClick={() => setItems((all) => all.filter((i) => i.id !== item.id))} className="text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition" aria-label="Remove item">×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setItems((all) => [...all, { id: Date.now(), lane, title: "New initiative" }])} className="mt-3 text-xs font-medium text-clay hover:text-clay-hover">+ Add item</button>
          </section>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Your roadmap stays in this browser session.</p>
        <button onClick={async () => { await navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-fg hover:opacity-90">{copied ? "Copied" : "Copy as Markdown"}</button>
      </div>
    </div>
  );
}
