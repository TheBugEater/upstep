import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { CodeShowcase } from "@/components/marketing/CodeShowcase";
import { BoardPreview } from "@/components/marketing/BoardPreview";
import { Pricing } from "@/components/marketing/Pricing";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Upstep — Feedback Widget & Voting for Web and Mobile Apps",
  description:
    "Add a feedback and voting widget to your web or mobile app in 2 lines of code. Collect bug reports, feature requests, and user votes. Free plan. No backend needed.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Upstep — Feedback Widget & Voting for Web and Mobile Apps",
    description:
      "Add a feedback and voting widget to your web or mobile app in 2 lines of code. Collect bug reports, feature requests, and user votes. Free plan. No backend needed.",
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
    "Drop-in feedback and voting widget for web and mobile apps. Collect bug reports, feature requests, and user votes in minutes.",
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
    "React and React Native SDK",
    "Webhook and Slack integrations",
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={SOFTWARE_LD} />
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
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

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Copy */}
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-clay" />
              Feedback widget for web &amp; mobile apps
            </span>

            <h1 className="mt-6 font-serif text-5xl md:text-[3.75rem] leading-[1.05] tracking-tight text-ink">
              Feedback that{" "}
              <span className="text-clay italic">moves you</span> forward
            </h1>

            <p className="mt-6 text-lg text-muted leading-relaxed max-w-md">
              Drop Upstep into your React, Next.js, or React Native app in
              2 lines of code. Collect bug reports and feature requests,
              let users vote on what matters most, and ship with confidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
              >
                Start collecting feedback
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#integrate"
                className="inline-flex items-center gap-2 bg-card border border-line text-ink rounded-full px-6 py-3 text-sm font-medium hover:bg-surface transition"
              >
                View the docs
              </Link>
            </div>

            <p className="mt-6 text-xs text-faint">
              Free plan available · 2-line integration
            </p>
          </div>

          {/* Product preview — tasks & upvotes board */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <BoardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Features ──────────────────────────── */

function Features() {
  const items = [
    {
      icon: "⚡",
      title: "2-line integration",
      body: "Install the package, paste your API key, and you're live. No backend to build.",
    },
    {
      icon: "▲",
      title: "Smart voting",
      body: "Anonymous or per-user up/down votes with built-in deduplication.",
    },
    {
      icon: "◷",
      title: "Real-time triage",
      body: "Filter by type and status, sort by votes, move items through your workflow.",
    },
    {
      icon: "❖",
      title: "Web & native",
      body: "Drop-in SDKs for React, vanilla JS, and React Native with shake-to-feedback.",
    },
  ];

  return (
    <section id="features" className="max-w-6xl mx-auto px-6 py-24">
      <SectionHeading
        eyebrow="Everything you need"
        title="A feedback loop that runs itself"
        sub={`From the moment a user taps “send” to the moment you ship the fix, Upstep handles the whole journey.`}
      />

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((f) => (
          <div
            key={f.title}
            className="group flex flex-col rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-clay/10 flex items-center justify-center text-clay text-lg mb-5 group-hover:bg-clay/15 transition">
              {f.icon}
            </div>
            <h3 className="font-semibold text-ink text-[17px] mb-2">{f.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    { n: "01", title: "Create a project", body: "Sign in and spin up a project. You get a unique API key instantly." },
    { n: "02", title: "Drop in the widget", body: "Add the SDK to your app with two lines of code. It mounts itself." },
    { n: "03", title: "Triage & ship", body: "Watch feedback roll into your dashboard. Sort by votes, ship what matters." },
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
              ["Framework native", "React, vanilla JS, script tag, or React Native."],
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
      <div className="relative overflow-hidden rounded-4xl bg-ink px-8 py-16 md:px-16 md:py-20 text-center">
        <div className="absolute inset-0 bg-glow opacity-50" />
        <div className="relative">
          <h2 className="font-serif text-4xl md:text-5xl text-white tracking-tight leading-tight">
            Start listening to your users today
          </h2>
          <p className="mt-4 text-white/60 max-w-md mx-auto">
            It takes two minutes to set up and zero infrastructure to run.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
            >
              Get started free
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 bg-white/10 text-white rounded-full px-7 py-3.5 text-sm font-medium hover:bg-white/15 transition border border-white/10"
            >
              Explore features
            </Link>
          </div>
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
