import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { WidgetGenerator } from "./WidgetGenerator";

export const metadata: Metadata = {
  title: "Free Feedback Widget Generator — Copy-Paste Script",
  description:
    "Generate a lightweight floating feedback button for any website. No signup, no backend — just a script tag you paste in, backed by mailto so feedback lands straight in your inbox.",
  alternates: { canonical: "/tools/feedback-widget-generator" },
  openGraph: {
    title: "Feedback Widget Generator | Upstep",
    description:
      "Generate a free, no-signup floating feedback button for any website in seconds.",
    url: "/tools/feedback-widget-generator",
    images: ["/opengraph-image"],
  },
};

export default function WidgetGeneratorPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Feedback Widget Generator",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://upstep.dev/tools/feedback-widget-generator",
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/tools" className="hover:text-ink transition">Tools</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Feedback widget generator</span>
        </nav>

        <div className="mb-10">
          <span className="inline-block text-xs font-semibold text-clay bg-clay/10 border border-clay/20 rounded-full px-3 py-1 mb-5">
            Free tool
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
            Feedback widget generator
          </h1>
          <p className="text-lg text-muted leading-relaxed">
            A floating feedback button for sites that don&apos;t want a full account. Customize it
            below, copy the snippet, paste it before <code className="text-[13px] bg-surface border border-line rounded px-1.5 py-0.5">&lt;/body&gt;</code>.
            Submissions open as a pre-filled email to you — no server required.
          </p>
        </div>

        <WidgetGenerator />

        <div className="mt-16 text-center rounded-2xl bg-clay/5 border border-clay/15 p-10">
          <h2 className="font-serif text-2xl text-ink mb-3">Outgrown mailto?</h2>
          <p className="text-muted mb-6 max-w-md mx-auto text-sm">
            Upstep gives you a real feedback inbox: voting, statuses, comments, and a public roadmap
            your users can follow — same idea, a lot more room to grow.
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
