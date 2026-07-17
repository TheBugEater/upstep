"use client";

import { useEffect, useState } from "react";
import { useOnRamp } from "@onramp-sdk/react";
import { McpCard } from "./McpCard";

type FrameworkId = "react" | "next" | "vue" | "nuxt" | "svelte" | "js" | "script" | "native" | "flutter";

const FRAMEWORKS: { id: FrameworkId; label: string }[] = [
  { id: "react", label: "React" },
  { id: "next", label: "Next.js" },
  { id: "vue", label: "Vue" },
  { id: "nuxt", label: "Nuxt" },
  { id: "svelte", label: "SvelteKit" },
  { id: "js", label: "Vanilla JS" },
  { id: "script", label: "Script tag" },
  { id: "native", label: "React Native" },
  { id: "flutter", label: "Flutter" },
];

/* ───────────────────── Button + slide-over drawer ───────────────────── */

export function SetupGuideButton({
  projectId,
  apiKey,
  baseUrl,
  mcpConfigured,
  isOwner,
  defaultOpen = false,
  sidebar = false,
}: {
  projectId: string;
  apiKey: string;
  baseUrl: string;
  mcpConfigured: boolean;
  isOwner: boolean;
  defaultOpen?: boolean;
  sidebar?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { step } = useOnRamp();

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => { step("setup_guide_opened"); setOpen(true); }}
        className={sidebar ? "w-full inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-clay hover:bg-clay/10 transition" : "inline-flex items-center gap-1.5 bg-card border border-line rounded-full px-3 sm:px-4 py-2 text-sm font-medium text-ink hover:bg-surface hover:border-line-strong transition shadow-soft shrink-0"}
      >
        <span className="text-clay">⚙</span>
        <span className={sidebar ? "inline" : "hidden sm:inline"}>Setup guide</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-canvas shadow-lift flex flex-col animate-fade-up">
            <header className="flex items-center justify-between px-6 h-16 border-b border-line shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-clay/10 text-clay flex items-center justify-center text-sm">
                  ⚙
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">Set up Upstep</div>
                  <div className="text-xs text-muted">Add the feedback widget in 2 steps</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg text-muted hover:bg-surface hover:text-ink transition flex items-center justify-center"
              >
                ✕
              </button>
            </header>

            <div className="overflow-y-auto px-6 py-6">
              <SetupGuideContent projectId={projectId} apiKey={apiKey} baseUrl={baseUrl} mcpConfigured={mcpConfigured} isOwner={isOwner} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── Guide content ──────────────────────────── */

function SetupGuideContent({ projectId, apiKey, baseUrl, mcpConfigured, isOwner }: { projectId: string; apiKey: string; baseUrl: string; mcpConfigured: boolean; isOwner: boolean }) {
  const [fw, setFw] = useState<FrameworkId>("react");
  const { step } = useOnRamp();
  const install = INSTALL[fw];
  const code = SNIPPETS[fw](apiKey, baseUrl);

  return (
    <div>
      {/* Framework tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {FRAMEWORKS.map((f) => (
          <button
            key={f.id}
            onClick={() => { step("framework_selected", { properties: { framework: f.id } }); setFw(f.id); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              fw === f.id ? "bg-primary text-primary-fg" : "bg-surface text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {install && (
        <Step n={1} title="Install the package">
          <CodeBlock code={install} />
        </Step>
      )}

      <Step n={install ? 2 : 1} title={fw === "script" ? "Drop in the script" : "Initialize with your API key"}>
        <CodeBlock code={code} />
        {fw === "next" && (
          <p className="text-xs text-muted mt-2">
            The <Code>"use client"</Code> directive is required because the widget uses browser APIs.
            Wrap it in its own file so your layout and page files can stay Server Components.
          </p>
        )}
        {fw === "nuxt" && (
          <p className="text-xs text-muted mt-2">
            Keep this in a <Code>.client.ts</Code> plugin so Nuxt only mounts Upstep in the browser.
          </p>
        )}
        {fw === "vue" && (
          <p className="text-xs text-muted mt-2">
            Mount once from your app shell with <Code>onMounted()</Code> so SSR builds never touch browser APIs on the server.
          </p>
        )}
        {fw === "svelte" && (
          <p className="text-xs text-muted mt-2">
            Mount from <Code>onMount()</Code> in your root layout so it stays client-only and survives route changes.
          </p>
        )}
        {fw === "flutter" && (
          <p className="text-xs text-muted mt-2">
            Mount <Code>Upstep</Code> once near your app root, then render <Code>FeedbackSheet</Code> and <Code>FeedbackButton</Code> inside the same tree.
          </p>
        )}
        {fw !== "script" && fw !== "next" && (
          <p className="text-xs text-muted mt-2">
            The floating <span className="font-medium text-ink-soft">Feedback</span> button mounts
            automatically. Pass <Code>userId</Code> to dedupe votes per signed-in user, or{" "}
            <Code>accentColor</Code> / <Code>position</Code> to style it.
          </p>
        )}
      </Step>

      <Step n={install ? 3 : 2} title="Test it" last>
        <p className="text-sm text-muted">
          Open your app, click the Feedback button, and submit a test note. It&apos;ll appear in the
          feedback table within a second.
        </p>
      </Step>

      <Patterns framework={fw} />

      <McpSetup projectId={projectId} baseUrl={baseUrl} configured={mcpConfigured} isOwner={isOwner} />

      <AiPrompt framework={fw} apiKey={apiKey} baseUrl={baseUrl} />
    </div>
  );
}

/* ─────────────────────────── Common patterns ────────────────────────── */

function Patterns({ framework }: { framework: FrameworkId }) {
  const [open, setOpen] = useState(true);
  const identify = IDENTIFY_SNIPPET[framework];
  const trigger = TRIGGER_SNIPPET[framework];

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/70 transition"
      >
        <span className="text-sm font-medium text-ink">Identify users &amp; custom triggers</span>
        <span className={`text-faint text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">
              Identify your logged-in user
            </p>
            <p className="text-xs text-muted mb-2">
              Ties votes to a user so they vote once per item. Works even if login resolves after
              mount, no need to delay mounting.
            </p>
            <CodeBlock code={identify} />
          </div>

          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">
              Trigger from your own UI (no floating button)
            </p>
            <p className="text-xs text-muted mb-2">
              Open feedback from a settings row, menu item, or app logic instead of the launcher.
            </p>
            <CodeBlock code={trigger} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Connect your AI agent ─────────────────────── */
// Separate from AiPrompt below: this connects an AI agent to the feedback
// inbox over MCP (triage, tasks, replies). AiPrompt instead generates a
// prompt for coding assistants to write the widget integration itself.

function McpSetup({ projectId, baseUrl, configured, isOwner }: { projectId: string; baseUrl: string; configured: boolean; isOwner: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/70 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="text-clay">✦</span>
          Connect your AI agent (MCP)
        </span>
        <span className={`text-faint text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Let Claude Code, Codex, Cursor, or any MCP client triage this
            project&apos;s inbox directly, list feedback, file Dev-only tasks,
            move cards, and reply to voters, without leaving your editor.
          </p>
          <McpCard projectId={projectId} baseUrl={baseUrl} configured={configured} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── AI integration ─────────────────────────── */

function AiPrompt({
  framework,
  apiKey,
  baseUrl,
}: {
  framework: FrameworkId;
  apiKey: string;
  baseUrl: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = buildAiPrompt(framework, apiKey, baseUrl);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-6 rounded-xl border border-clay/25 bg-clay-tint/60 p-5">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-clay/15 text-clay flex items-center justify-center text-sm shrink-0">
          ✦
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Building with AI?</div>
          <div className="text-xs text-muted mt-0.5">
            Copy a ready-made prompt for Cursor, Claude Code, Copilot, or any coding assistant. It
            includes your API key and exact integration steps.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 bg-clay text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-clay-hover transition"
        >
          {copied ? "✓ Copied prompt" : "Copy AI prompt"}
        </button>
        <button onClick={() => setShow((v) => !v)} className="text-sm text-muted hover:text-ink transition">
          {show ? "Hide" : "Preview"}
        </button>
      </div>

      {show && (
        <pre className="mt-4 rounded-lg bg-[#1A1915] text-white/90 text-xs font-mono p-4 overflow-x-auto whitespace-pre-wrap">
          {prompt}
        </pre>
      )}
    </div>
  );
}

/* ───────────────────────────── helpers ──────────────────────────────── */

function Step({
  n,
  title,
  children,
  last,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`relative pl-9 ${last ? "" : "pb-6"}`}>
      {!last && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-line" />}
      <span className="absolute left-0 top-0 w-7 h-7 rounded-full bg-primary text-primary-fg text-xs font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="text-sm font-semibold text-ink mb-2 pt-0.5">{title}</div>
      {children}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-[#1A1915] text-white/90 text-[13px] font-mono p-4 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 text-[11px] px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20 transition"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] bg-surface border border-line rounded px-1 py-0.5 text-ink-soft">
      {children}
    </code>
  );
}

/* ───────────────────────────── content ──────────────────────────────── */

const INSTALL: Record<FrameworkId, string | null> = {
  react: "npm install @upstep/js",
  next: "npm install @upstep/js",
  vue: "npm install @upstep/js",
  nuxt: "npm install @upstep/js",
  svelte: "npm install @upstep/js",
  js: "npm install @upstep/js",
  script: null,
  native:
    "npm install @upstep/react-native\n# peer deps:\nnpm install @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler",
  flutter: "flutter pub add upstep_flutter",
};

const SNIPPETS: Record<FrameworkId, (apiKey: string, baseUrl: string) => string> = {
  next: (apiKey, baseUrl) => `// components/UpstepWidget.tsx
"use client";

import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export function UpstepWidget() {
  return (
    <UpstepProvider
      apiKey="${apiKey}"
      baseUrl="${baseUrl}"
      // theme="auto"      // "light" | "dark" | "auto" (default)
      // accentColor="#D97757"
    >
      <FeedbackWidget />
    </UpstepProvider>
  );
}

// app/layout.tsx
import { UpstepWidget } from "@/components/UpstepWidget";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <UpstepWidget />
      </body>
    </html>
  );
}`,
  react: (apiKey, baseUrl) => `import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export default function App({ children }) {
  return (
    <UpstepProvider
      apiKey="${apiKey}"
      baseUrl="${baseUrl}"
      // theme="auto"      // "light" | "dark" | "auto" (default)
      // accentColor="#D97757"
    >
      {children}
      <FeedbackWidget />
    </UpstepProvider>
  );
}`,
  vue: (apiKey, baseUrl) => `<script setup lang="ts">
import { onMounted } from "vue";
import Upstep from "@upstep/js";

onMounted(() => {
  Upstep.init({
    apiKey: "${apiKey}",
    baseUrl: "${baseUrl}",
  });
});
</script>

<template>
  <RouterView />
</template>`,
  nuxt: (apiKey, baseUrl) => `// plugins/upstep.client.ts
import Upstep from "@upstep/js";

export default defineNuxtPlugin(() => {
  Upstep.init({
    apiKey: "${apiKey}",
    baseUrl: "${baseUrl}",
  });
});`,
  svelte: (apiKey, baseUrl) => `<script lang="ts">
  import { onMount } from "svelte";
  import Upstep from "@upstep/js";

  onMount(() => {
    Upstep.init({
      apiKey: "${apiKey}",
      baseUrl: "${baseUrl}",
    });
  });
</script>

<slot />`,
  js: (apiKey, baseUrl) => `import Upstep from "@upstep/js";

Upstep.init({
  apiKey: "${apiKey}",
  baseUrl: "${baseUrl}",
});`,
  script: (apiKey, baseUrl) => `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="${apiKey}"
  data-base-url="${baseUrl}"
></script>`,
  native: (apiKey, baseUrl) => `import {
  FeedbackProvider,
  FeedbackSheet,
  FeedbackButton,
} from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider
      apiKey="${apiKey}"
      baseUrl="${baseUrl}"
      // userId="user-123"    // tie votes to the logged-in user
      // accentColor="#D97757"
      // theme="auto"         // "light" | "dark" | "auto" (default)
    >
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
      {/*
        FeedbackSheet has three built-in screens:
          - Feed list , shows all items sorted by upvotes; tap to upvote
          - Feed detail, full description + developer comments
          - Create    , title + description + type selector
      */}
    </FeedbackProvider>
  );
}`,
  flutter: (apiKey, baseUrl) => `import 'package:flutter/material.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Upstep(
        apiKey: "${apiKey}",
        baseUrl: "${baseUrl}",
        child: Scaffold(
          appBar: AppBar(title: const Text("Your app")),
          body: Stack(
            children: const [
              Center(child: Text("Your app UI")),
              FeedbackSheet(),
              FeedbackButton(),
            ],
          ),
        ),
      ),
    );
  }
}`,
};

const IDENTIFY_SNIPPET: Record<FrameworkId, string> = {
  next: `// Inside your UpstepWidget component (already "use client"):
import { useUpstep } from "@upstep/js/react";

const { identify } = useUpstep();
useEffect(() => {
  if (user) identify(user.id);
}, [user]);`,
  react: `import { useUpstep } from "@upstep/js/react";

const { identify } = useUpstep();
useEffect(() => {
  if (user) identify(user.id);
}, [user]);`,
  vue: `onMounted(() => {
  Upstep.init({ apiKey: "...", userId: user.value?.id });
});

watch(
  () => user.value?.id,
  (id) => {
    if (id) Upstep.identify(id);
  },
);`,
  nuxt: `// plugins/upstep.client.ts
export default defineNuxtPlugin(() => {
  const user = useState<{ id?: string } | null>("auth-user");

  Upstep.init({ apiKey: "...", userId: user.value?.id });

  watch(
    () => user.value?.id,
    (id) => {
      if (id) Upstep.identify(id);
    },
  );
});`,
  svelte: `import { onMount } from "svelte";
import Upstep from "@upstep/js";

export let user: { id?: string } | null = null;

onMount(() => {
  Upstep.init({ apiKey: "...", userId: user?.id });
});

$: if (user?.id) {
  Upstep.identify(user.id);
}`,
  js: `Upstep.init({ apiKey: "..." });

// later, once the user logs in:
Upstep.identify(user.id);`,
  script: `// Import the module to call identify():
import Upstep from "@upstep/js";

Upstep.identify(user.id); // after login`,
  native: `import { useUpstep } from "@upstep/react-native";

const { identify } = useUpstep();
useEffect(() => {
  // Ties votes to the user so they can only vote once per item.
  // Also makes their own PENDING items visible while awaiting review.
  if (user) identify(user.id);
}, [user]);`,
  flutter: `final upstep = Upstep.of(context, listen: false);

@override
void didUpdateWidget(covariant MyApp oldWidget) {
  super.didUpdateWidget(oldWidget);
  upstep.identify(user?.id);
}`,
};

const TRIGGER_SNIPPET: Record<FrameworkId, string> = {
  next: `// components/UpstepWidget.tsx  ("use client" already set)
import { FeedbackWidget, useUpstep } from "@upstep/js/react";

// 1. Hide the floating button:
<FeedbackWidget hideLauncher />

// 2. Open from any Client Component:
const { open } = useUpstep();
<button onClick={open}>Send feedback</button>`,
  react: `import { FeedbackWidget, useUpstep } from "@upstep/js/react";

// 1. Render the modal without the floating button:
<FeedbackWidget hideLauncher />

// 2. Open it from your own UI:
const { open } = useUpstep();
<button onClick={open}>Send feedback</button>`,
  vue: `onMounted(() => {
  Upstep.init({ apiKey: "...", launcher: false });
});

function openFeedback() {
  Upstep.open();
}`,
  nuxt: `// plugins/upstep.client.ts
export default defineNuxtPlugin(() => {
  Upstep.init({ apiKey: "...", launcher: false });
});

// any client component
const openFeedback = () => Upstep.open();`,
  svelte: `onMount(() => {
  Upstep.init({ apiKey: "...", launcher: false });
});

function openFeedback() {
  Upstep.open();
}`,
  js: `// Turn the launcher off:
Upstep.init({ apiKey: "...", launcher: false });

// Open from your own button:
myButton.addEventListener("click", () => Upstep.open());`,
  script: `// With launcher off, import the module to open it:
import Upstep from "@upstep/js";
Upstep.init({ apiKey: "...", launcher: false });
myButton.addEventListener("click", () => Upstep.open());`,
  native: `import { FeedbackSheet, useUpstep } from "@upstep/react-native";

// Render the sheet (no <FeedbackButton/> needed):
<FeedbackSheet />

// Open it from anywhere:
const { openSheet } = useUpstep();
<Pressable onPress={openSheet}><Text>Send feedback</Text></Pressable>`,
  flutter: `final upstep = Upstep.of(context, listen: false);

// Keep the sheet mounted once:
const FeedbackSheet()

// Hide the floating launcher by omitting FeedbackButton,
// then open it from your own UI:
FilledButton(
  onPressed: upstep.openSheet,
  child: const Text("Send feedback"),
)`,
};

function buildAiPrompt(framework: FrameworkId, apiKey: string, baseUrl: string): string {
  const pkg =
    framework === "native"
      ? "@upstep/react-native"
      : framework === "flutter"
        ? "upstep_flutter"
        : "@upstep/js";
  const install =
    framework === "native"
      ? "npm install @upstep/react-native @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler"
      : framework === "flutter"
        ? "flutter pub add upstep_flutter"
      : framework === "script"
        ? "(no install, loaded via <script>)"
        : "npm install @upstep/js";
  const appLabel =
    framework === "native"
      ? "React Native"
      : framework === "next"
        ? "Next.js"
        : framework === "vue"
          ? "Vue"
          : framework === "nuxt"
            ? "Nuxt"
            : framework === "svelte"
              ? "SvelteKit"
              : framework === "flutter"
                ? "Flutter"
              : "web";
  const mountRule =
    framework === "next"
      ? 'Wrap the provider and widget in a "use client" component, they use browser APIs and cannot run in a Server Component.'
      : framework === "nuxt"
        ? "Mount Upstep from a .client.ts plugin so it only runs in the browser."
        : framework === "vue"
        ? "Call Upstep.init() inside onMounted() near the app root so SSR never touches browser APIs."
        : framework === "svelte"
            ? "Call Upstep.init() inside onMount() near the root layout so it only runs client-side."
            : framework === "flutter"
              ? "Wrap your app near the root with Upstep and keep FeedbackSheet mounted in the widget tree so openSheet() can present it from anywhere."
            : "Mount the provider once at the app root so the widget is available on every screen.";

  return `I want to integrate Upstep (a drop-in feedback & voting widget) into my ${appLabel} app. Before writing any code, ask me these questions one at a time and wait for my answers:

1. Do users log in to this app? If yes, what does the signed-in user object look like and how do I access it (e.g. \`session.user.id\`, \`useUser().id\`, \`auth.currentUser.uid\`)?
2. Where should the Feedback button appear, on every screen, or only specific pages?
3. Do you want a floating button (default) or should it open from your own UI element like a menu item or settings row?

Once I answer, wire up the integration using these details:

Package: ${pkg}
Install: ${install}
API key: ${apiKey}
Backend URL: ${baseUrl}

Base integration to follow:

${SNIPPETS[framework](apiKey, baseUrl)}

Rules to follow when writing the code:
- If the user has a signed-in user id available, ALWAYS pass it as \`userId\` to the provider and call \`identify(userId)\` whenever auth state changes. This deduplicates votes per user and is strongly recommended.
- ${mountRule}
- The widget talks to ${baseUrl}/api/sdk/* using an x-api-key header. No extra backend setup is needed.
- Change nothing else in the codebase, only add what is necessary to mount Upstep.

After wiring it up, tell me exactly where you placed the code and how to verify a test submission appears in the dashboard.`;
}
