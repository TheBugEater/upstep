import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { GUIDES } from "../data";

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = GUIDES[(await params).slug];
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, url: `/guides/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = GUIDES[(await params).slug];
  if (!guide) notFound();

  const ld = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: guide.title,
    description: guide.description,
    author: { "@type": "Organization", name: "Upstep" },
    proficiencyLevel: "Beginner",
    timeRequired: `PT${guide.minutes}M`,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/guides" className="hover:text-ink transition">Guides</Link>
          <span className="mx-2">/</span>
          <span>{guide.category}</span>
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] gap-12">
          <article className="min-w-0 max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">
              {guide.category} · {guide.minutes} minute guide
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl text-ink mt-3 mb-5 leading-tight">{guide.title}</h1>
            <p className="text-lg text-muted leading-relaxed">{guide.description}</p>
            <p className="mt-5 text-sm text-ink-soft leading-relaxed">{guide.intro}</p>

            <section className="mt-10 rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-ink">Before you begin</h2>
              <ul className="mt-3 space-y-2">
                {guide.prerequisites.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted">
                    <span className="text-clay font-bold">✓</span>{item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-14 space-y-14">
              {guide.sections.map((section, index) => (
                <section key={section.title} id={`step-${index + 1}`} className="scroll-mt-24">
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay/10 border border-clay/20 text-xs font-bold text-clay">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-semibold tracking-tight text-ink">{section.title}</h2>
                      <p className="text-sm text-muted leading-7 mt-3">{section.body}</p>
                      {section.details && (
                        <ul className="mt-4 space-y-2.5 border-l-2 border-clay/20 pl-4">
                          {section.details.map((detail) => <li key={detail} className="text-sm leading-6 text-ink-soft">{detail}</li>)}
                        </ul>
                      )}
                      {section.code && (
                        <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-[#181715] p-4 sm:p-5 text-xs leading-6 text-[#e7e2da] shadow-soft">
                          <code>{section.code}</code>
                        </pre>
                      )}
                      {section.checklist && (
                        <div className="mt-5 rounded-xl border border-success/20 bg-success/5 p-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-success">Check before moving on</h3>
                          <ul className="mt-3 space-y-2">
                            {section.checklist.map((item) => <li key={item} className="flex gap-2 text-sm text-ink-soft"><span className="text-success">□</span>{item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <section className="mt-16 border-t border-line pt-12">
              <h2 className="font-serif text-3xl text-ink">Troubleshooting</h2>
              <div className="mt-6 space-y-3">
                {guide.troubleshooting.map((item) => (
                  <details key={item.issue} className="group rounded-xl border border-line bg-card px-5 py-4">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-semibold text-ink">
                      {item.issue}<span className="text-faint group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="mt-3 text-sm text-muted leading-6">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <aside className="mt-16 rounded-2xl border border-clay/20 bg-clay/5 p-8">
              <h2 className="font-serif text-2xl text-ink">Put the guide into practice</h2>
              <p className="text-sm text-muted mt-2 mb-5">Create an Upstep project, copy its key, and test the integration on the free plan.</p>
              <Link href="/login" className="inline-flex rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white hover:bg-clay-hover transition">Get started free →</Link>
            </aside>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-line bg-card p-4 shadow-soft">
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">In this guide</p>
              <ol className="mt-2 space-y-1">
                {guide.sections.map((section, index) => (
                  <li key={section.title}>
                    <a href={`#step-${index + 1}`} className="block rounded-lg px-2 py-2 text-xs leading-5 text-muted hover:bg-surface hover:text-ink transition">
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ol>
              <a href="#" className="mt-3 block border-t border-line px-2 pt-3 text-xs font-medium text-clay hover:text-clay-hover">Back to top ↑</a>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
