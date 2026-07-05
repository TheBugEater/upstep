import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { INTEGRATIONS } from "../data";

export function generateStaticParams() {
  return Object.keys(INTEGRATIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const i = INTEGRATIONS[slug];
  if (!i) return {};
  return {
    title: `${i.name} Feedback Widget | Upstep`,
    description: `Add a feedback and voting widget to your ${i.name} app in minutes. ${i.intro}`,
    alternates: { canonical: `/integrations/${slug}` },
    openGraph: {
      title: i.headline,
      description: i.intro,
      url: `/integrations/${slug}`,
    },
  };
}

export default async function IntegrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const i = INTEGRATIONS[slug];
  if (!i) notFound();

  const ld = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: i.headline,
    description: i.intro,
    url: `https://upstep.dev/integrations/${slug}`,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/integrations" className="hover:text-ink transition">Integrations</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{i.name}</span>
        </nav>

        <div className="mb-14">
          <span className="inline-block text-xs font-semibold text-clay bg-clay/10 border border-clay/20 rounded-full px-3 py-1 mb-5">
            {i.category}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
            {i.headline}
          </h1>
          <p className="text-lg text-muted leading-relaxed mb-8">{i.intro}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
          >
            Get your API key free
            <span aria-hidden>→</span>
          </Link>
        </div>

        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-6">Setup steps</h2>
          <ol className="space-y-4">
            {i.steps.map((step, idx) => (
              <li key={step} className="flex items-start gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-clay/10 text-clay text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm text-ink-soft leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-6">Code</h2>
          <div className="rounded-2xl border border-line-strong bg-[#1A1915] shadow-lift overflow-hidden">
            <div className="flex items-center gap-2 px-4 h-11 border-b border-white/10">
              <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              <span className="ml-3 text-xs text-white/40 font-mono">{i.codeLang}</span>
            </div>
            <pre className="px-5 py-5 text-[13px] leading-relaxed font-mono text-white/90 overflow-x-auto">
              <code>{i.code}</code>
            </pre>
          </div>
          {i.notes && (
            <ul className="mt-4 space-y-2">
              {i.notes.map((note) => (
                <li key={note} className="text-xs text-faint leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-14 rounded-2xl border border-clay/25 bg-clay/[0.04] p-7">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-clay/10 text-clay flex items-center justify-center text-base shrink-0">✦</span>
            <div>
              <h2 className="font-serif text-xl text-ink mb-2">While you're here: connect an AI agent</h2>
              <p className="text-sm text-muted leading-relaxed max-w-xl">
                Every Upstep project ships a built-in MCP server. Once feedback starts
                flowing in from {i.name}, Claude Code, Cursor, or any MCP client can list
                it, triage it, and file Dev-only tasks, without leaving your editor.
              </p>
              <Link
                href="/#mcp"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-clay hover:text-clay-hover transition"
              >
                See how the MCP server works
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        <div className="text-center rounded-2xl bg-clay/5 border border-clay/15 p-10">
          <h2 className="font-serif text-2xl text-ink mb-3">
            Start collecting feedback in {i.name} today
          </h2>
          <p className="text-muted mb-6 max-w-md mx-auto text-sm">
            Free plan. No credit card. Your API key is ready the moment you sign up.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-semibold hover:bg-clay-hover transition shadow-soft"
          >
            Get started free
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
