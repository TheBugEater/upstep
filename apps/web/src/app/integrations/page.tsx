import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { INTEGRATIONS, type Integration } from "./data";

export const metadata: Metadata = {
  title: "Integrations. Add Upstep to Any Stack",
  description:
    "Drop the Upstep feedback widget into React, Next.js, Vue, Svelte, Astro, WordPress, Shopify, React Native, Expo, and more.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    title: "Upstep Integrations",
    description: "Add a feedback and voting widget to any web or mobile stack.",
    url: "/integrations",
  },
};

export default function IntegrationsIndexPage() {
  const items = Object.values(INTEGRATIONS);
  const categories = ["Framework", "Build tool", "No-code / CMS", "Mobile"] as const;
  const byCategory: Record<string, Integration[]> = {};
  for (const cat of categories) byCategory[cat] = items.filter((i) => i.category === cat);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Integrations</span>
        </nav>

        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
          Add Upstep to any stack
        </h1>
        <p className="text-lg text-muted leading-relaxed max-w-2xl mb-14">
          A typed React SDK, a framework-agnostic script for everything else, and a native
          React Native package for mobile. Pick your platform below.
        </p>

        {categories.map((cat) => (
          byCategory[cat]!.length > 0 && (
            <section key={cat} className="mb-12">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-clay mb-4">{cat}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {byCategory[cat]!.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/integrations/${i.slug}`}
                    className="group rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
                  >
                    <h3 className="font-semibold text-ink text-lg group-hover:text-clay transition">
                      {i.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2">{i.intro}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay">
                      View setup
                      <span aria-hidden>→</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )
        ))}

        <div className="mt-4 text-center">
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
