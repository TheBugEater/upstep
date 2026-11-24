"use client";

import { useState } from "react";

type Tab = { id: string; label: string; lang: string; code: string };

const TABS: Tab[] = [
  {
    id: "script",
    label: "Script tag",
    lang: "html",
    code: `<script
  defer
  src="https://upstep.dev/sdk/upstep.js"
  data-api-key="YOUR_PROJECT_KEY"
></script>`,
  },
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
    id: "vue",
    label: "Vue",
    lang: "vue",
    code: `<script setup>
import { onMounted } from "vue";
import Upstep from "@upstep/js";

onMounted(() => {
  Upstep.init({ apiKey: "upstep_xxx" });
});
</script>`,
  },
  {
    id: "svelte",
    label: "SvelteKit",
    lang: "svelte",
    code: `<script>
  import { onMount } from "svelte";
  import Upstep from "@upstep/js";

  onMount(() => {
    Upstep.init({ apiKey: "upstep_xxx" });
  });
</script>`,
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
  {
    id: "flutter",
    label: "Flutter",
    lang: "dart",
    code: `import 'package:flutter/material.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

MaterialApp(
  home: Upstep(
    apiKey: "upstep_xxx",
    child: Stack(
      children: const [FeedbackSheet(), FeedbackButton()],
    ),
  ),
);`,
  },
];

export function CodeShowcase() {
  const [active, setActive] = useState(TABS[0]!.id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#4c3930] bg-[#221b18] shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-xs font-medium text-[#ffb99d]">Widget embed</span>
        <span className="font-mono text-xs text-white/65">{tab.lang}</span>
      </div>

      {/* Tabs */}
      <div role="group" aria-label="Integration options" className="flex flex-wrap items-center gap-1 px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={active === t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              active === t.id
                ? "bg-white/10 text-white"
                : "text-white/65 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Code */}
      <pre className="min-h-[8.5rem] overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed text-white/90">
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
