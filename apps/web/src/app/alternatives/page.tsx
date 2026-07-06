import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { COMPETITORS } from "./data";

export const metadata: Metadata = {
  title: "Upstep Alternatives. Compare vs Canny, Featurebase, Frill & More",
  description:
    "See how Upstep compares to Canny, UserVoice, Productboard, Featurebase, Frill, Upvoty, Nolt, Sleekplan, Hellonext, Usersnap, Marker.io, Beamer, and Fider on pricing, features, and MCP support for AI agents.",
  alternates: { canonical: "/alternatives" },
  openGraph: {
    title: "Upstep Alternatives. Feature & Pricing Comparisons",
    description:
      "Compare Upstep against the most popular feedback and roadmap tools on the market.",
    url: "/alternatives",
    images: ["/opengraph-image"],
  },
};

export default function AlternativesIndexPage() {
  const competitors = Object.values(COMPETITORS);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Alternatives</span>
        </nav>

        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
          Compare Upstep to the alternatives
        </h1>
        <p className="text-lg text-muted leading-relaxed max-w-2xl mb-14">
          Looking for a feedback widget, roadmap tool, or bug-report inbox? Here's how Upstep
          stacks up against the tools developers compare it to most, pricing, features, the
          honest tradeoffs, and whether an AI agent can triage the inbox for you.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {competitors.map((c) => (
            <Link
              key={c.slug}
              href={`/alternatives/${c.slug}`}
              className="group rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
            >
              <span className="text-xs font-semibold text-clay uppercase tracking-wide">
                vs {c.name}
              </span>
              <h2 className="mt-2 font-semibold text-ink text-lg group-hover:text-clay transition">
                {c.headline}
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2">{c.intro}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay">
                Compare
                <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
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
