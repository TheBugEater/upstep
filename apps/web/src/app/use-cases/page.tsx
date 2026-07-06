import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { USE_CASES } from "./data";

export const metadata: Metadata = {
  title: "Use Cases. Feedback Widget for Every Kind of Team",
  description:
    "See how SaaS teams, indie hackers, agencies, mobile app developers, and more use Upstep to collect and prioritize feedback.",
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "Upstep Use Cases",
    description: "How different teams use Upstep to collect and prioritize feedback.",
    url: "/use-cases",
    images: ["/opengraph-image"],
  },
};

export default function UseCasesIndexPage() {
  const items = Object.values(USE_CASES);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Use cases</span>
        </nav>

        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
          Built for how you actually work
        </h1>
        <p className="text-lg text-muted leading-relaxed max-w-2xl mb-14">
          Same widget, same free plan, here's how different teams put it to work.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((u) => (
            <Link
              key={u.slug}
              href={`/use-cases/${u.slug}`}
              className="group rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
            >
              <span className="text-xs font-semibold text-clay uppercase tracking-wide capitalize">
                {u.audience}
              </span>
              <h2 className="mt-2 font-semibold text-ink text-lg group-hover:text-clay transition">
                {u.headline}
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2">{u.intro}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay">
                Read more
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
