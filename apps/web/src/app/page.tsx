import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { CodeShowcase } from "@/components/marketing/CodeShowcase";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { McpDemo } from "@/components/marketing/McpDemo";
import { FeatureCards } from "@/components/marketing/FeatureCards";
import { Pricing } from "@/components/marketing/Pricing";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Upstep | Feedback Widget, Voting Boards & MCP for Your Product",
  description:
    "Open-source feedback and voting for web and mobile apps. Triage on fluid boards, publish a roadmap, and let AI agents manage feedback through MCP.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Upstep | Feedback Widget, Voting Boards & MCP for Your Product",
    description:
      "Open-source feedback and voting for web and mobile apps, with fluid boards, public roadmaps, and a built-in MCP server for AI agents.",
    url: "/",
  },
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Upstep",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web, iOS, Android",
  url: "https://upstep.dev",
  description:
    "Open-source feedback and voting for web and mobile apps with fluid triage boards and a built-in MCP server for AI agents.",
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  codeRepository: "https://github.com/TheBugEater/upstep",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "19", priceCurrency: "USD" },
    { "@type": "Offer", name: "Business", price: "49", priceCurrency: "USD" },
  ],
  featureList: [
    "Embeddable feedback widget",
    "User voting on feedback",
    "Bug report collection",
    "Feature request management",
    "Kanban triage boards",
    "Built-in MCP server for AI agents",
    "React, React Native, and Flutter SDKs",
    "Webhook and Slack integrations",
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={SOFTWARE_LD} />
      <Nav />
      <Hero />
      <FeatureCards />
      <HowItWorks />
      <Mcp />
      <OpenSource />
      <Integrate />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

/* ────────────────────────────── Hero ────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div className="absolute inset-0 bg-glow" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-canvas" />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* Copy */}
          <div className="animate-fade-up">
            <Link
              href="#open-source"
              className="inline-flex items-center gap-2 rounded-full border border-clay/25 bg-clay/[0.07] px-3 py-1 text-xs font-medium text-clay shadow-sm hover:bg-clay/[0.12] transition"
            >
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-clay animate-pulse-ring" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-clay" />
              </span>
              Now open source · AGPL-3.0
              <span aria-hidden>→</span>
            </Link>

            <h1 className="mt-6 font-serif text-5xl md:text-[3.75rem] leading-[1.05] tracking-tight text-ink">
              Feedback that{" "}
              <span className="text-clay italic">ships itself</span>
            </h1>

            <p className="mt-6 text-lg text-muted leading-relaxed max-w-md">
              Drop Upstep into your app in 2 lines of code. Users report bugs
              and vote on ideas, your team triages on a fluid board, and your
              AI agent closes the loop over MCP.
            </p>

            <form action="/login" method="GET" className="mt-8 flex flex-wrap items-center gap-3">
              <input
                type="text"
                name="appName"
                placeholder="Your app's name"
                maxLength={80}
                required
                aria-label="Your app's name"
                className="flex-1 min-w-[220px] px-5 py-3 bg-card border border-line rounded-full text-sm text-ink placeholder-faint shadow-sm focus:outline-none focus:border-clay focus:ring-4 focus:ring-clay/10 transition"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-clay-hover transition shadow-soft shrink-0"
              >
                Get started free
                <span aria-hidden>→</span>
              </button>
            </form>
            <Link
              href="#integrate"
              className="mt-3 inline-block text-sm text-muted hover:text-ink transition"
            >
              or view the docs →
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              <p className="text-xs text-faint">
                Free plan available · 2-line integration · No credit card
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <span className="text-clay" aria-hidden>★</span>
                10K+ feedback items processed
              </p>
            </div>
          </div>

          {/* Live animated product demo */}
          <div className="animate-fade-up [animation-delay:120ms] lg:pl-4 pb-8">
            <HeroDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Open source ────────────────────────── */

function OpenSource() {
  return (
    <section id="open-source" className="max-w-6xl mx-auto px-6 py-24">
      <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-[#191816] px-8 py-12 shadow-lift md:px-14 md:py-16">
        <div className="absolute inset-0 bg-glow opacity-40" />
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-clay/15 blur-3xl" />

        <div className="relative grid min-w-0 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70">
              <span className="text-clay" aria-hidden>◆</span>
              Open source · Self-hostable · Built in public
            </div>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight tracking-tight text-white md:text-5xl">
              Your users&apos; feedback should never be a black box.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-white/60">
              The complete Upstep application is open source: dashboard, APIs,
              roadmaps, integrations, SDKs, and the MCP server. Inspect every
              security boundary, run it on your infrastructure, or help shape
              what comes next.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://github.com/TheBugEater/upstep"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#191816] transition hover:bg-white/90"
              >
                View on GitHub
                <span aria-hidden>↗</span>
              </a>
              <Link
                href="/blog/upstep-is-open-source"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-clay/60 hover:text-clay"
              >
                Why we opened it
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5 font-mono text-xs shadow-soft sm:p-6">
            <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-2 text-white/35">self-host upstep</span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[520px] space-y-2 leading-relaxed text-white/65">
                <p><span className="text-clay">$</span> git clone https://github.com/TheBugEater/upstep.git</p>
                <p><span className="text-clay">$</span> cd upstep</p>
                <p><span className="text-clay">$</span> cp apps/web/.env.example apps/web/.env</p>
                <p><span className="text-clay">$</span> docker compose up --build</p>
                <p className="pt-3 text-[#73D18B]">✓ dashboard · api · mcp · postgres</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 text-center">
              <div><p className="text-sm font-semibold text-white">AGPL</p><p className="mt-1 text-[10px] text-white/35">server</p></div>
              <div><p className="text-sm font-semibold text-white">MIT</p><p className="mt-1 text-[10px] text-white/35">SDKs</p></div>
              <div><p className="text-sm font-semibold text-white">No Redis</p><p className="mt-1 text-[10px] text-white/35">required</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    { n: "01", title: "Create a project", body: "Sign in and spin up a project. You get a unique API key instantly." },
    { n: "02", title: "Drop in the widget", body: "Add the SDK to your app with two lines of code. It mounts itself." },
    { n: "03", title: "Triage & ship", body: "Feedback rolls into your board sorted by votes. Ship what matters." },
  ];

  return (
    <section id="how" className="bg-surface border-y border-line">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Live in three steps"
          sub="No SDK gymnastics. No server setup. Just feedback, flowing."
        />

        <div className="mt-14 grid md:grid-cols-3 gap-8 relative">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="font-serif text-5xl text-clay/30 mb-4">{s.n}</div>
              <h3 className="font-semibold text-ink text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed max-w-xs">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────── MCP ──────────────────────────────── */

function Mcp() {
  return (
    <section id="mcp" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-glow opacity-70" />
      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-clay">
              Built-in MCP server
            </span>
            <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink">
              Give your AI direct access to your users
            </h2>
            <p className="mt-5 text-muted leading-relaxed">
              Connect Claude Code, Codex, Cursor, Windsurf, Copilot, or any MCP
              client to your feedback inbox. Your agent reads what users want,
              creates and updates tasks, posts replies, and keeps the board
              tidy. Access is scoped to a single project by its API key.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                ["Triage from your editor", "“What's the most-voted bug?” answered without leaving your flow."],
                ["Internal by default", "Agent tasks are created Dev-only, and it can spin up its own board. Users never see the machinery."],
                ["Agents that act", "Create tasks, change statuses, comment. Every change lands on the live board."],
                ["Nothing to deploy", "The server is part of Upstep. Point your client at one URL and go."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/15 text-clay flex items-center justify-center text-xs shrink-0">✓</span>
                  <div>
                    <span className="text-sm font-medium text-ink">{t}.</span>{" "}
                    <span className="text-sm text-muted">{d}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-line bg-card p-4 font-mono text-xs text-muted overflow-x-auto shadow-soft">
              <p className="text-faint mb-1"># Claude Code</p>
              <p className="whitespace-nowrap">
                <span className="text-clay">claude</span> mcp add --transport http upstep \
              </p>
              <p className="pl-4 whitespace-nowrap">https://upstep.dev/api/mcp \</p>
              <p className="pl-4 whitespace-nowrap">
                --header <span className="text-ink-soft">&quot;Authorization: Bearer YOUR_MCP_KEY&quot;</span>
              </p>
              <p className="text-faint mt-3 mb-1"># Codex CLI</p>
              <p className="whitespace-nowrap">
                <span className="text-clay">export</span> UPSTEP_MCP_KEY=&quot;YOUR_MCP_KEY&quot;
              </p>
              <p className="whitespace-nowrap">
                <span className="text-clay">codex</span> mcp add upstep --url https://upstep.dev/api/mcp \
              </p>
              <p className="pl-4 whitespace-nowrap">--bearer-token-env-var UPSTEP_MCP_KEY</p>
            </div>
          </div>

          <McpDemo />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Integrate / dev ─────────────────────── */

function Integrate() {
  return (
    <section id="integrate" className="max-w-6xl mx-auto px-6 py-24">
      <div className="grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-clay">
            For developers
          </span>
          <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink">
            Built to disappear into your stack
          </h2>
          <p className="mt-5 text-muted leading-relaxed">
            Typed SDKs, framework-native components, and a tiny footprint. Pick
            your platform and ship. Upstep handles storage, dedupe, and the UI.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              ["Fully typed", "First-class TypeScript across every SDK."],
              ["Tiny bundle", "The web widget is under 10 kB gzipped."],
              ["Framework native", "React, vanilla JS, script tag, React Native, or Flutter."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/15 text-clay flex items-center justify-center text-xs shrink-0">✓</span>
                <div>
                  <span className="text-sm font-medium text-ink">{t}.</span>{" "}
                  <span className="text-sm text-muted">{d}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <CodeShowcase />
      </div>
    </section>
  );
}

/* ─────────────────────────────── CTA ───────────────────────────── */

function CTA() {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-24">
      <div className="relative overflow-hidden rounded-4xl bg-[#161513] px-8 py-16 md:px-16 md:py-20 text-center">
        <div className="absolute inset-0 bg-glow opacity-50" />
        <div className="relative">
          <h2 className="font-serif text-4xl md:text-5xl text-white tracking-tight leading-tight">
            Start listening to your users today
          </h2>
          <p className="mt-4 text-white/60 max-w-md mx-auto">
            It takes two minutes to set up and zero infrastructure to run.
          </p>
          <form
            action="/login"
            method="GET"
            className="mt-8 flex flex-wrap items-center justify-center gap-3 max-w-md mx-auto"
          >
            <input
              type="text"
              name="appName"
              placeholder="Your app's name"
              maxLength={80}
              required
              aria-label="Your app's name"
              className="flex-1 min-w-[200px] px-5 py-3.5 bg-white/10 border border-white/15 rounded-full text-sm text-white placeholder-white/40 focus:outline-none focus:border-clay focus:ring-4 focus:ring-clay/20 transition"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-medium hover:bg-clay-hover transition shadow-soft shrink-0"
            >
              Get started free
              <span aria-hidden>→</span>
            </button>
          </form>
          <p className="mt-4 text-xs text-white/40">
            Free plan · No credit card · Trusted for 10K+ feedback items and counting
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Shared heading ──────────────────────── */

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-2xl">
      <span className="text-xs font-semibold uppercase tracking-wider text-clay">{eyebrow}</span>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink">{title}</h2>
      <p className="mt-4 text-muted leading-relaxed">{sub}</p>
    </div>
  );
}
