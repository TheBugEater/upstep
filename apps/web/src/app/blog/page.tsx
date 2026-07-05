import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { sortedPosts } from "./data";

export const metadata: Metadata = {
  title: "Blog. Product Updates & Notes from Upstep",
  description:
    "Product updates, design notes, and the occasional origin story from the team building Upstep.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "The Upstep Blog",
    description: "Product updates and notes from the team building Upstep.",
    url: "/blog",
  },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = sortedPosts();

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">Blog</span>
        </nav>

        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-6">
          Notes from the team
        </h1>
        <p className="text-lg text-muted leading-relaxed max-w-2xl mb-14">
          Product updates, design decisions, and the occasional story about
          why we built things the way we did.
        </p>

        <div className="space-y-4">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="font-semibold text-clay uppercase tracking-wide">{p.tag}</span>
                <span>·</span>
                <time dateTime={p.date}>{formatDate(p.date)}</time>
                <span>·</span>
                <span>{p.readMinutes} min read</span>
              </div>
              <h2 className="mt-2.5 font-serif text-2xl text-ink group-hover:text-clay transition">
                {p.title}
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2 max-w-2xl">
                {p.description}
              </p>
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
