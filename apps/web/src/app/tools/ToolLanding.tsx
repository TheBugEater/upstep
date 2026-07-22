import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";
import { JsonLd } from "@/components/JsonLd";

export function toolMetadata(title: string, description: string, slug: string): Metadata {
  return { title: `${title} — Free, No Signup`, description, alternates: { canonical: `/tools/${slug}` }, openGraph: { title: `${title} | Upstep`, description, url: `/tools/${slug}`, images: ["/opengraph-image"] } };
}

export function ToolLanding({ title, description, children, points }: { title: string; description: string; children: ReactNode; points: [string, string, string] }) {
  return <div className="min-h-screen bg-canvas"><JsonLd data={{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: title, applicationCategory: "BusinessApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }} /><Nav /><main className="max-w-5xl mx-auto px-6 py-16 sm:py-20"><nav className="text-xs text-faint mb-8"><Link href="/tools" className="hover:text-ink">Tools</Link><span className="mx-2">/</span><span>{title}</span></nav><div className="max-w-3xl"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Free tool · no signup</span><h1 className="font-serif text-4xl sm:text-5xl text-ink mt-3 leading-tight">{title}</h1><p className="text-lg text-muted leading-relaxed mt-5">{description}</p></div>{children}<section className="mt-16 grid md:grid-cols-3 gap-5">{points.map((point, index) => <article key={point} className="rounded-2xl border border-line bg-card p-5"><p className="text-xs font-semibold text-clay">0{index + 1}</p><p className="mt-2 text-sm leading-6 text-muted">{point}</p></article>)}</section><section className="mt-16 rounded-2xl border border-clay/20 bg-clay/5 p-8 text-center"><h2 className="font-serif text-2xl text-ink">Need evidence for the next product decision?</h2><p className="text-sm text-muted mt-2 mb-5">Collect requests, votes, and product feedback with Upstep.</p><Link href="/feedback-board" className="inline-flex rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white hover:bg-clay-hover">Explore the feedback board →</Link></section></main><Footer /></div>;
}
