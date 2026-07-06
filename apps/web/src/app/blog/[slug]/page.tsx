import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/JsonLd";
import { BLOG_POSTS, sortedPosts, type BlogBlock } from "../data";

export function generateStaticParams() {
  return Object.keys(BLOG_POSTS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS[slug];
  if (!post) return {};
  return {
    title: `${post.title} | Upstep Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${slug}`,
      type: "article",
      images: ["/opengraph-image"],
    },
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS[slug];
  if (!post) notFound();

  const more = sortedPosts().filter((p) => p.slug !== slug).slice(0, 2);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url: `https://upstep.dev/blog/${slug}`,
    author: { "@type": "Organization", name: "Upstep" },
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main className="max-w-2xl mx-auto px-6 py-20">
        <nav className="text-xs text-faint mb-8">
          <Link href="/" className="hover:text-ink transition">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-ink transition">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{post.title}</span>
        </nav>

        <div className="mb-10">
          <div className="flex items-center gap-3 text-xs text-faint mb-4">
            <span className="font-semibold text-clay uppercase tracking-wide">{post.tag}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-ink leading-tight mb-5">
            {post.title}
          </h1>
          <p className="text-lg text-muted leading-relaxed">{post.description}</p>
        </div>

        <article className="space-y-5">
          {post.body.map((block, i) => (
            <BlogBlockView key={i} block={block} />
          ))}
        </article>

        <div className="mt-16 rounded-2xl bg-clay/5 border border-clay/15 p-8 text-center">
          <h2 className="font-serif text-2xl text-ink mb-3">Start collecting feedback today</h2>
          <p className="text-muted mb-6 max-w-md mx-auto text-sm">
            Free plan. 2-line integration. Your API key is ready the moment you sign up.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-semibold hover:bg-clay-hover transition shadow-soft"
          >
            Get started free
            <span aria-hidden>→</span>
          </Link>
        </div>

        {more.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-faint mb-4">
              More from the blog
            </h2>
            <div className="space-y-3">
              {more.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block rounded-xl border border-line bg-card p-4 hover:border-clay/25 hover:shadow-soft transition"
                >
                  <p className="text-sm font-medium text-ink group-hover:text-clay transition">
                    {p.title}
                  </p>
                  <p className="mt-1 text-xs text-muted line-clamp-1">{p.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function BlogBlockView({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-ink-soft leading-relaxed">{block.text}</p>;
    case "h2":
      return <h2 className="font-serif text-2xl text-ink pt-3">{block.text}</h2>;
    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-ink-soft leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-clay shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <div className="rounded-xl border border-line-strong bg-[#1C1B19] overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            <span className="ml-2 text-[10px] text-white/40 font-mono">{block.lang}</span>
          </div>
          <pre className="px-4 py-3.5 text-[12.5px] leading-relaxed font-mono text-white/90 overflow-x-auto">
            <code>{block.code}</code>
          </pre>
        </div>
      );
  }
}
