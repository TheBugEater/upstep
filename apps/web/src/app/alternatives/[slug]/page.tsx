import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";

// ─── Competitor data ──────────────────────────────────────────────────────────

type Feature = { label: string; upstep: boolean; them: boolean };

type Competitor = {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  theirPitch: string;
  painPoints: string[];
  features: Feature[];
  verdict: string;
};

const COMPETITORS: Record<string, Competitor> = {
  canny: {
    slug: "canny",
    name: "Canny",
    headline: "The Canny alternative built for developers",
    intro:
      "Canny is a popular feedback board tool aimed at product teams. It works well for public roadmaps — but if you need to embed a widget directly inside your app and let users vote without leaving, it falls short. Upstep was built specifically for that workflow.",
    theirPitch:
      "Canny hosts your feedback on a separate board (canny.io/your-company). Users leave your app, submit feedback, and return. There is no native embed SDK for your product UI.",
    painPoints: [
      "No embeddable widget — users are redirected to an external board",
      "Per-seat pricing scales poorly for small teams",
      "No React Native SDK for mobile apps",
      "Free tier limited to 200 tracked users with Canny branding",
      "Requires a separate subdomain, adding friction for users",
    ],
    features: [
      { label: "Embeddable widget (no redirect)", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
      { label: "Free plan (no credit card)", upstep: true, them: true },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "White-label (remove branding)", upstep: true, them: false },
    ],
    verdict:
      "If you want a public roadmap board, Canny is a solid choice. If you want feedback to live inside your product — a widget your users can open without leaving your app — Upstep is the better fit, and it starts free.",
  },

  uservoice: {
    slug: "uservoice",
    name: "UserVoice",
    headline: "The UserVoice alternative that's actually affordable",
    intro:
      "UserVoice is one of the oldest feedback tools in the market, built for enterprise customer success teams. Its pricing starts at $699/month and the integration story is built around support portals, not developer SDKs. Upstep gives you the same core loop — collect, vote, ship — without the enterprise overhead.",
    theirPitch:
      "UserVoice targets enterprise product and customer success teams with features like NPS surveys, CRM integrations, and account-level segmentation. It is a powerful platform, but the minimum contract is far out of reach for indie developers, startups, or small teams.",
    painPoints: [
      "Pricing starts at $699/month — no free tier for small teams",
      "Complex setup requires CS team onboarding",
      "No lightweight embeddable widget; portal-first approach",
      "Overkill for teams that just need a feedback widget",
      "Long sales cycle before you can even try the product",
    ],
    features: [
      { label: "Free plan available", upstep: true, them: false },
      { label: "Embeddable in-app widget", upstep: true, them: false },
      { label: "React / JS / React Native SDK", upstep: true, them: false },
      { label: "User voting", upstep: true, them: true },
      { label: "Self-serve signup", upstep: true, them: false },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "No annual contract required", upstep: true, them: false },
    ],
    verdict:
      "UserVoice is built for enterprise teams with six-figure budgets and dedicated customer success teams. If you're a developer or small team that wants to start collecting feedback today — free, embedded, and without a sales call — Upstep is the answer.",
  },

  productboard: {
    slug: "productboard",
    name: "Productboard",
    headline: "The Productboard alternative for feedback collection",
    intro:
      "Productboard is a full product management platform: roadmaps, prioritization frameworks, OKR alignment, and more. If you need all of that, it's a strong tool. But most developers don't — they need a widget that collects feedback and surfaces what users actually want. Upstep does exactly that, for free.",
    theirPitch:
      "Productboard charges per maker (editor) seat, starting around $20/month per user. A team of five would pay $100/month before collecting a single piece of feedback. The platform requires significant setup and training to get value from its prioritization features.",
    painPoints: [
      "Per-seat pricing — a team of 5 pays $100+/month",
      "Feedback collection is a small part of a large, complex platform",
      "No lightweight embeddable widget for end-user apps",
      "Requires onboarding and workflow setup before use",
      "No mobile SDK for React Native apps",
    ],
    features: [
      { label: "Free plan available", upstep: true, them: false },
      { label: "Embeddable in-app feedback widget", upstep: true, them: false },
      { label: "End-user voting on feedback", upstep: true, them: true },
      { label: "React Native mobile SDK", upstep: true, them: false },
      { label: "2-line code setup", upstep: true, them: false },
      { label: "Bug report + feature request types", upstep: true, them: true },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "No per-seat pricing", upstep: true, them: false },
    ],
    verdict:
      "Productboard is a product management suite. If you just need a feedback widget that slots into your app, lets users vote, and surfaces what to build next, Upstep gets you there in minutes — not sprints.",
  },
};

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) return {};
  return {
    title: `Best ${c.name} Alternative — ${c.headline}`,
    description: `Looking for a ${c.name} alternative? Upstep is a developer-first feedback widget with a free plan, 2-line integration, and React Native support. No redirects, no per-seat pricing.`,
    alternates: { canonical: `/alternatives/${slug}` },
    openGraph: {
      title: `Best ${c.name} Alternative — Upstep`,
      description: `Looking for a ${c.name} alternative? Upstep is a developer-first feedback widget with a free plan, 2-line integration, and React Native support.`,
      url: `/alternatives/${slug}`,
    },
  };
}

export default async function AlternativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) notFound();

  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.headline,
    description: `Compare Upstep vs ${c.name} — features, pricing, and which is right for your team.`,
    url: `https://upstep.dev/alternatives/${slug}`,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main className="max-w-3xl mx-auto px-6 py-20">

        {/* Breadcrumb */}
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/alternatives/canny" className="hover:text-ink transition">Alternatives</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{c.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-14">
          <span className="inline-block text-xs font-semibold text-clay bg-clay/10 border border-clay/20 rounded-full px-3 py-1 mb-5">
            {c.name} alternative
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
            {c.headline}
          </h1>
          <p className="text-lg text-muted leading-relaxed mb-8">{c.intro}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
          >
            Try Upstep free — no credit card
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Why people leave */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-4">
            Why developers look for a {c.name} alternative
          </h2>
          <p className="text-muted mb-5 leading-relaxed">{c.theirPitch}</p>
          <ul className="space-y-2.5">
            {c.painPoints.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shrink-0 text-[10px] font-bold">✕</span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Comparison table */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-6">
            Upstep vs {c.name} — feature comparison
          </h2>
          <div className="rounded-2xl border border-line overflow-hidden shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-line">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Feature</th>
                  <th className="px-5 py-3 text-xs font-semibold text-clay uppercase tracking-wide text-center">Upstep</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide text-center">{c.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-card">
                {c.features.map((f) => (
                  <tr key={f.label} className="hover:bg-surface/50 transition">
                    <td className="px-5 py-3.5 text-ink-soft">{f.label}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Check yes={f.upstep} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Check yes={f.them} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Verdict */}
        <section className="mb-16 rounded-2xl bg-clay/5 border border-clay/15 p-7">
          <h2 className="font-serif text-xl text-ink mb-3">The bottom line</h2>
          <p className="text-muted leading-relaxed">{c.verdict}</p>
        </section>

        {/* CTA */}
        <div className="text-center">
          <h2 className="font-serif text-3xl text-ink mb-4">Start collecting feedback today</h2>
          <p className="text-muted mb-8 max-w-md mx-auto">
            Free plan. 2-line integration. No credit card, no sales call, no redirect to a third-party board.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-semibold hover:bg-clay-hover transition shadow-soft"
          >
            Get started free
            <span aria-hidden>→</span>
          </Link>
          <p className="mt-4 text-xs text-faint">Free plan · No credit card · 2-line setup</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 border border-green-100 text-green-600 text-[11px] font-bold mx-auto">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface border border-line text-faint text-[11px] font-bold mx-auto">✕</span>
  );
}
