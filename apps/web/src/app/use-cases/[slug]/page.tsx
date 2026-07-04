import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { USE_CASES } from "../data";

export function generateStaticParams() {
  return Object.keys(USE_CASES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const u = USE_CASES[slug];
  if (!u) return {};
  return {
    title: u.headline,
    description: u.intro,
    alternates: { canonical: `/use-cases/${slug}` },
    openGraph: {
      title: u.headline,
      description: u.intro,
      url: `/use-cases/${slug}`,
    },
  };
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const u = USE_CASES[slug];
  if (!u) notFound();

  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: u.headline,
    description: u.intro,
    url: `https://upstep.dev/use-cases/${slug}`,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/use-cases" className="hover:text-ink transition">Use cases</Link>
          <span className="mx-2">/</span>
          <span className="text-muted capitalize">{u.audience}</span>
        </nav>

        <div className="mb-14">
          <span className="inline-block text-xs font-semibold text-clay bg-clay/10 border border-clay/20 rounded-full px-3 py-1 mb-5">
            For {u.audience}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
            {u.headline}
          </h1>
          <p className="text-lg text-muted leading-relaxed mb-8">{u.intro}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
          >
            Get started free
            <span aria-hidden>→</span>
          </Link>
        </div>

        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-5">The challenge</h2>
          <ul className="space-y-2.5">
            {u.challenges.map((c) => (
              <li key={c} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shrink-0 text-[10px] font-bold">✕</span>
                {c}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="font-serif text-2xl text-ink mb-6">How Upstep helps</h2>
          <div className="grid gap-4">
            {u.benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-line bg-card p-6 shadow-soft">
                <h3 className="font-semibold text-ink text-[15px] mb-2">{b.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center rounded-2xl bg-clay/5 border border-clay/15 p-10">
          <h2 className="font-serif text-2xl text-ink mb-3">Start collecting feedback today</h2>
          <p className="text-muted mb-6 max-w-md mx-auto text-sm">{u.ctaNote}</p>
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
