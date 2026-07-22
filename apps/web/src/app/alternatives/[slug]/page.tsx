import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { COMPETITORS } from "../data";

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
    title: `Best ${c.name} Alternative. ${c.headline}`,
    description: `Looking for a ${c.name} alternative? Upstep is a developer-first feedback widget with a free plan, 2-line integration, and React Native support. No redirects, no per-seat pricing.`,
    alternates: { canonical: `/alternatives/${slug}` },
    openGraph: {
      title: `Best ${c.name} Alternative | Upstep`,
      description: `Looking for a ${c.name} alternative? Upstep is a developer-first feedback widget with a free plan, 2-line integration, and React Native support.`,
      url: `/alternatives/${slug}`,
      images: ["/opengraph-image"],
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
    description: `Compare Upstep vs ${c.name}, features, pricing, and which is right for your team.`,
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
          <Link href="/alternatives" className="hover:text-ink transition">Alternatives</Link>
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
            Try Upstep free, no credit card
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
                <span className="mt-0.5 w-4 h-4 rounded-full bg-danger/10 border border-danger/25 text-danger flex items-center justify-center shrink-0 text-[10px] font-bold">✕</span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Comparison table */}
        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-6">
            Upstep vs {c.name}, feature comparison
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
        <section className="mb-8 rounded-2xl bg-clay/5 border border-clay/15 p-7">
          <h2 className="font-serif text-xl text-ink mb-3">The bottom line</h2>
          <p className="text-muted leading-relaxed">{c.verdict}</p>
        </section>

        {/* Also unique to Upstep, shared across every comparison */}
        <section className="mb-16 rounded-2xl border border-line bg-card p-7 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-clay/10 text-clay flex items-center justify-center text-sm shrink-0">✦</span>
            <h2 className="font-serif text-xl text-ink">Also unique to Upstep</h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              ["Built-in MCP server", "Claude Code, Cursor, or any MCP client can triage this project's inbox directly, without leaving your editor."],
              ["Fluid triage boards", "Custom columns and drag-to-reorder, tuned to feel instant instead of clunky."],
              ["Dev-only tasks", `${c.name} doesn't separate internal work from the public roadmap. Upstep does, agent and team tasks stay off the board your users see.`],
              ["Separate agent workspace", "Your AI can run its own board for internal tasks, entirely apart from user feedback."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-clay/15 text-clay flex items-center justify-center text-[10px] shrink-0">✓</span>
                <div>
                  <span className="text-sm font-medium text-ink">{t}.</span>{" "}
                  <span className="text-sm text-muted">{d}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center">
          <h2 className="font-serif text-3xl text-ink mb-4">Start collecting feedback today</h2>
          <p className="text-muted mb-8 max-w-md mx-auto">
            Free plan. 2-line integration. No credit card, no sales call, no redirect to a third-party board.
          </p>
          <p className="mb-6 text-sm text-muted">See how an <Link href="/feedback-board" className="font-medium text-clay hover:text-clay-hover">in-app feedback board</Link> works before you compare plans.</p>
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
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/10 border border-success/25 text-success text-[11px] font-bold mx-auto">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface border border-line text-faint text-[11px] font-bold mx-auto">✕</span>
  );
}
