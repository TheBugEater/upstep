import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { RiceCalculator } from "./RiceCalculator";

export const metadata: Metadata = {
  title: "RICE Score Calculator — Free Feature Prioritization Tool",
  description:
    "Free RICE (Reach, Impact, Confidence, Effort) calculator. Score and rank your backlog to decide what to build next. No signup, runs entirely in your browser.",
  alternates: { canonical: "/tools/rice-calculator" },
  openGraph: {
    title: "RICE Score Calculator | Upstep",
    description:
      "Score and rank your backlog by Reach, Impact, Confidence, and Effort. Free, no signup.",
    url: "/tools/rice-calculator",
    images: ["/opengraph-image"],
  },
};

export default function RiceCalculatorPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RICE Score Calculator",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://upstep.dev/tools/rice-calculator",
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
          <span className="text-muted">RICE calculator</span>
        </nav>

        <div className="mb-10">
          <span className="inline-block text-xs font-semibold text-clay bg-clay/10 border border-clay/20 rounded-full px-3 py-1 mb-5">
            Free tool
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
            RICE score calculator
          </h1>
          <p className="text-lg text-muted leading-relaxed">
            Score every feature by Reach, Impact, Confidence, and Effort, then sort by score to see
            what to build next. Everything runs in your browser — nothing is saved or sent anywhere.
          </p>
        </div>

        <RiceCalculator />

        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink mb-5">How RICE scoring works</h2>
          <div className="space-y-4 text-sm text-ink-soft leading-relaxed">
            <p>
              RICE is a prioritization framework popularized by Intercom. Each feature gets a score
              from four inputs, and higher scores should get built first:
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/10 border border-clay/25 text-clay flex items-center justify-center shrink-0 text-[10px] font-bold">R</span>
                <span><strong className="text-ink">Reach</strong> — how many people this will affect in a given time period (e.g. users per month).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/10 border border-clay/25 text-clay flex items-center justify-center shrink-0 text-[10px] font-bold">I</span>
                <span><strong className="text-ink">Impact</strong> — how much it moves the needle for each person: 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/10 border border-clay/25 text-clay flex items-center justify-center shrink-0 text-[10px] font-bold">C</span>
                <span><strong className="text-ink">Confidence</strong> — how sure you are about your Reach and Impact estimates, as a percentage.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-clay/10 border border-clay/25 text-clay flex items-center justify-center shrink-0 text-[10px] font-bold">E</span>
                <span><strong className="text-ink">Effort</strong> — how many person-months it will take to build.</span>
              </li>
            </ul>
            <p className="font-mono text-xs bg-surface border border-line rounded-lg px-4 py-3 inline-block text-ink-soft">
              score = (reach × impact × confidence) / effort
            </p>
          </div>
        </section>

        <div className="mt-16 text-center rounded-2xl bg-clay/5 border border-clay/15 p-10">
          <h2 className="font-serif text-2xl text-ink mb-3">Once you've prioritized, collect the votes yourself</h2>
          <p className="text-muted mb-6 max-w-md mx-auto text-sm">
            Upstep gives your users a public board to vote on what's next, so your next RICE pass starts with real data instead of guesses.
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
