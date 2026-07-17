import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { TOOLS } from "./data";

export const metadata: Metadata = {
  title: "Free Tools for Product Teams",
  description:
    "Free, no-signup tools for product teams: a RICE prioritization calculator, a feedback widget generator, and more.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free Tools for Product Teams | Upstep",
    description:
      "Free, no-signup tools for product teams: a RICE prioritization calculator, a feedback widget generator, and more.",
    url: "/tools",
    images: ["/opengraph-image"],
  },
};

export default function ToolsIndexPage() {
  const items = Object.values(TOOLS);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Tools</span>
        </nav>

        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
          Free tools for product teams
        </h1>
        <p className="text-lg text-muted leading-relaxed max-w-2xl mb-14">
          No signup, no email gate. Just useful things, made by the team behind Upstep.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="group rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
            >
              <span className="text-xs font-semibold text-clay uppercase tracking-wide">
                {t.tagline}
              </span>
              <h2 className="mt-2 font-semibold text-ink text-lg group-hover:text-clay transition">
                {t.name}
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2">{t.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay">
                Open tool
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
