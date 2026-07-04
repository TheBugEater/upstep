"use client";

import { useState } from "react";

type Tab = { id: string; label: string; lang: string; code: string };

const TABS: Tab[] = [
  {
    id: "react",
    label: "React",
    lang: "tsx",
    code: `import { UpstepProvider, FeedbackWidget }
  from "@upstep/js/react";

export default function App({ children }) {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      {children}
      <FeedbackWidget />
    </UpstepProvider>
  );
}`,
  },
  {
    id: "js",
    label: "Vanilla JS",
    lang: "js",
    code: `import Upstep from "@upstep/js";

// Mounts the feedback button automatically
Upstep.init({ apiKey: "upstep_xxx" });`,
  },
  {
    id: "script",
    label: "Script tag",
    lang: "html",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },
  {
    id: "native",
    label: "React Native",
    lang: "tsx",
    code: `import { FeedbackProvider, FeedbackButton, FeedbackSheet }
  from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider apiKey="upstep_xxx">
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}`,
  },
];

export function CodeShowcase() {
  const [active, setActive] = useState(TABS[0]!.id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <div className="rounded-2xl border border-line-strong bg-[#1C1B19] shadow-lift overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-xs text-white/40 font-mono">{tab.lang}</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              active === t.id
                ? "bg-white/10 text-white"
                : "text-white/45 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Code */}
      <pre className="px-5 py-5 text-[13px] leading-relaxed font-mono text-white/90 overflow-x-auto">
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
