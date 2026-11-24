import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { CodeShowcase } from "@/components/marketing/CodeShowcase";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";
import { Pricing } from "@/components/marketing/Pricing";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { SupportIcon } from "@/components/support/SupportIcons";
import { getPrice, PLAN_ORDER, PLANS } from "@/lib/plans";

const TITLE = "AI Chat Support, Feedback & Roadmaps";
const DESCRIPTION =
  "Help customers with AI and live chat, collect in-app feedback and votes, and share a public roadmap. Upstep is open source and self-hostable.";

const landingFont = Noto_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Upstep` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: `${TITLE} | Upstep`, description: DESCRIPTION, url: "/" },
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Upstep",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web, iOS, Android",
  url: "https://upstep.dev",
  description: DESCRIPTION,
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  codeRepository: "https://github.com/TheBugEater/upstep",
  offers: PLAN_ORDER.map((plan) => ({
    "@type": "Offer",
    name: PLANS[plan].name,
    price: getPrice(plan, "USD"),
    priceCurrency: "USD",
  })),
  featureList: [
    "AI and live support chat",
    "Shared support inbox and private tickets",
    "Embeddable feedback widget and voting",
    "Kanban triage boards and public roadmaps",
    "React, React Native and Flutter SDKs",
    "Built-in MCP server",
  ],
};

const SUPPORT_FEATURES = [
  {
    icon: "message",
    title: "AI answers from your website",
    body: "Review what Upstep learns from your public pages. The assistant uses that knowledge to answer questions and link to sources.",
  },
  {
    icon: "person",
    title: "Your team can take over",
    body: "Pick up the conversation in a shared inbox with its history, assignments and private notes.",
  },
  {
    icon: "ticket",
    title: "Private tickets for follow-up",
    body: "Turn unresolved chats into tickets your team can track on your board.",
  },
] as const;

const SETUP_STEPS = [
  {
    icon: "plus",
    title: "Create a project",
    body: "Give your product a name or start with your website. Your project comes with a publishable widget key.",
  },
  {
    icon: "plug",
    title: "Add the widget",
    body: "Paste the web embed or use a native SDK. On a paid plan, review your support knowledge and enable chat.",
  },
  {
    icon: "message",
    title: "Open your inbox and board",
    body: "Reply to customers from the inbox and triage ideas and bugs on your feedback board.",
  },
] as const;

const FAQS = [
  {
    question: "Which plans include Chat Support?",
    answer: "Pro and Business include AI chat, live chat, the shared inbox and private tickets. The Free plan includes in-app feedback and voting. Chat Support is also available on self-hosted installs.",
  },
  {
    question: "Can I offer support with my team alone?",
    answer: "Yes. Select team-only routing to collect the customer’s issue and contact details for your team. With AI enabled, your team can take over conversations from the shared inbox.",
  },
  {
    question: "What does the AI learn from?",
    answer: "It uses public pages from the business website you connect, plus the business details you review and confirm. It can link to the pages it uses to answer customers.",
  },
  {
    question: "Will support chats appear on my public roadmap?",
    answer: "Support conversations and their follow-up tickets are private. Your public roadmap shows the product work you choose to share.",
  },
  {
    question: "Where can I embed the widget?",
    answer: "Use the hosted script or JavaScript and React SDKs on the web. React Native and Flutter SDKs also support feedback and chat inside mobile apps.",
  },
];

const CONTAINER = "mx-auto w-full max-w-[1248px] px-5 sm:px-8";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.14em] text-clay-dark";
const HEADING = "text-[2.5rem] leading-[1.04] tracking-[-0.055em] text-ink sm:text-[3.1rem]";
const CTA_STYLE = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay";

export default function HomePage() {
  return (
    <div className={`${landingFont.className} min-h-screen bg-[#fcfaf7] dark:bg-canvas`}>
      <JsonLd data={SOFTWARE_LD} />
      <Nav />
      <main>
        <Hero />
        <Support />
        <Product />
        <Setup />
        <Developer />
        <Pricing />
        <Questions />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className={`${CONTAINER} grid items-center gap-8 pb-14 pt-9 sm:gap-10 sm:pb-20 sm:pt-16 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12 lg:pb-24 lg:pt-[5.5rem]`}>
      <div>
        <p className={`${EYEBROW} inline-flex items-center gap-2 rounded-md border border-clay/20 bg-clay-tint px-2.5 py-1.5`}>
          <SupportIcon name="message" className="h-3.5 w-3.5" />
          AI &amp; live Chat Support
        </p>
        <h1 className="mt-5 text-[clamp(2.9rem,12vw,3.7rem)] font-normal leading-[0.98] tracking-[-0.065em] text-ink sm:text-[4.6rem] lg:text-[4.35rem] xl:text-[4.85rem]">
          Help users.<br />{" "}
          Build what<br />{" "}
          <span className="text-clay-dark">matters.</span>
        </h1>
        <p className="mt-6 max-w-[26rem] text-base leading-relaxed text-muted sm:text-lg">
          Answer customers with AI and live chat, collect feedback in the same widget, and show users what you’re building next.
        </p>
        <StartForm />
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs text-muted">Free feedback plan · No credit card</span>
          <Link href="#support" className="text-xs font-semibold text-clay-dark underline-offset-4 hover:underline">
            Explore Chat Support <span aria-hidden>↓</span>
          </Link>
        </div>
      </div>
      <ProductPreview />
    </section>
  );
}

function StartForm({ inverse = false }: { inverse?: boolean }) {
  return (
    <form action="/login" method="GET" className="mt-6 flex w-full max-w-[27rem] flex-col gap-2 min-[375px]:flex-row sm:mt-7">
      <input
        type="text"
        name="appName"
        autoComplete="off"
        placeholder="Your product name"
        maxLength={80}
        required
        aria-label="Your product name"
        className={`min-w-0 flex-1 rounded-lg border px-3.5 py-3 text-sm transition focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/30 ${inverse ? "border-white/25 bg-white/10 text-white placeholder:text-[#dfcfc8]" : "border-line-strong bg-card text-ink placeholder:text-faint"}`}
      />
      <button type="submit" className={`${CTA_STYLE} shrink-0 ${inverse ? "bg-[#ffaf8d] text-[#26150e] hover:bg-[#ffc4ac]" : "bg-primary text-primary-fg hover:bg-primary/85"}`}>
        Get started free <span aria-hidden>→</span>
      </button>
    </form>
  );
}

function Support() {
  return (
    <section id="support" aria-labelledby="support-heading" className={`${CONTAINER} scroll-mt-24`}>
      <div className="relative isolate grid overflow-hidden rounded-4xl bg-[#221b18] px-6 py-10 text-white sm:px-10 sm:py-14 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16 lg:px-14 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_95%_100%,#643724,transparent_72%)]" />
        <div>
          <p className={`${EYEBROW} !text-[#ffae8c]`}>Chat Support</p>
          <h2 id="support-heading" className={`${HEADING} mt-4 !text-white`}>Help customers in the moment.</h2>
          <ul className="mt-8 space-y-5">
            {SUPPORT_FEATURES.map(({ icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#ffae8c]/25 bg-[#ffae8c]/10 text-[#ffae8c]">
                  <SupportIcon name={icon} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#decbc2]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/guides/customer-support" className={`${CTA_STYLE} bg-[#ffaf8d] text-[#26150e] hover:bg-[#ffc4ac]`}>
              Set up Chat Support <span aria-hidden>→</span>
            </Link>
            <Link href="#pricing" className="text-xs font-medium text-[#ead4c9] underline-offset-4 hover:underline">Included in Pro and Business</Link>
          </div>
        </div>

        <figure className="mt-10 self-center rounded-2xl border border-white/15 bg-[#2a201c] p-4 shadow-[0_24px_54px_-22px_#130d0b] sm:p-6 lg:mt-0">
          <figcaption className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SupportIcon name="history" className="h-4 w-4 text-[#ffae8c]" /> Conversation history
            </div>
            <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-[#ead4c9]">Example</span>
          </figcaption>
          <ol className="relative mt-5 space-y-4 before:absolute before:bottom-6 before:left-3.5 before:top-5 before:w-px before:bg-white/15">
            <TimelineItem icon="message" title="AI replied with a source">
              <p>Try narrowing the date range before exporting.</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/[0.08] px-2 py-1 text-[11px] text-[#ffb99d]">
                <SupportIcon name="link" className="h-3 w-3" /> Exporting reports
              </p>
            </TimelineItem>
            <TimelineItem icon="person" title="Alex took over the chat">
              <p>I’ll reproduce the issue and follow up.</p>
            </TimelineItem>
            <TimelineItem icon="lock" title="Private ticket created">
              <p><span className="font-mono text-[11px] text-[#ffb99d]">UP-1042</span> · Investigate stalled CSV export</p>
            </TimelineItem>
          </ol>
        </figure>
      </div>
    </section>
  );
}

function TimelineItem({ icon, title, children }: { icon: ComponentProps<typeof SupportIcon>["name"]; title: string; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full border border-[#76513e] bg-[#422b22] text-[#ffae8c]">
        <SupportIcon name={icon} className="h-3.5 w-3.5" />
      </span>
      <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 sm:px-3.5">
        <p className="text-xs font-semibold text-white">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-[#decbc2]">{children}</div>
      </div>
    </li>
  );
}

function Product() {
  return (
    <section id="features" aria-labelledby="features-heading" className={`${CONTAINER} scroll-mt-24 py-16 sm:py-24`}>
      <p className={EYEBROW}>Feedback &amp; roadmap</p>
      <h2 id="features-heading" className={`${HEADING} mt-3 max-w-3xl`}>Build with your users.</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-line bg-card">
          <div className="p-6 pb-5 sm:p-8 sm:pb-6">
            <SupportIcon name="arrow" className="mb-4 h-5 w-5 text-clay-dark" />
            <h3 className="text-xl font-semibold tracking-tight text-ink">Prioritise ideas with votes.</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Collect feature requests and bugs inside your app. When ideas come up in chat, customers can vote on a match or submit a new request.</p>
            <TextLink href="/feedback-board">Explore feedback boards</TextLink>
          </div>
          <div className="border-t border-clay/10 bg-clay-tint px-6 py-5 sm:px-8">
            <div aria-hidden className="overflow-hidden rounded-xl border border-clay/15 bg-card shadow-soft">
              <div className="flex items-center gap-3 border-b border-line px-3.5 py-3 text-sm">
                <span className="rounded-md bg-clay-tint px-2 py-1 font-mono text-xs font-semibold text-clay-dark">↑ 42</span>
                <span className="font-medium text-ink">Save a dashboard filter</span>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-3 text-sm">
                <span className="rounded-md bg-surface px-2 py-1 font-mono text-xs font-semibold text-muted">↑ 24</span>
                <span className="font-medium text-ink">Export reports as PDF</span>
              </div>
            </div>
          </div>
        </article>
        <article className="overflow-hidden rounded-3xl border border-line bg-card">
          <div className="p-6 pb-5 sm:p-8 sm:pb-6">
            <SupportIcon name="check" className="mb-4 h-5 w-5 text-clay-dark" />
            <h3 className="text-xl font-semibold tracking-tight text-ink">Share what’s shipping.</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Triage work with statuses, labels and assignees, then publish the updates your customers should see on your roadmap.</p>
            <TextLink href="/guides/how-to-build-a-public-roadmap">Learn to publish a roadmap</TextLink>
          </div>
          <div className="border-t border-line bg-[#eaece4] px-6 py-5 dark:bg-[#18201b] sm:px-8">
            <div aria-hidden className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0 rounded-xl border border-line bg-card px-3 py-3 shadow-soft sm:px-4">
                <p className="mb-2 text-xs font-semibold text-info">● In progress</p>
                <p className="rounded-md bg-surface p-2 text-xs font-medium text-ink">Save a dashboard filter</p>
              </div>
              <div className="min-w-0 rounded-xl border border-line bg-card px-3 py-3 shadow-soft sm:px-4">
                <p className="mb-2 text-xs font-semibold text-success">● Shipped</p>
                <p className="rounded-md bg-surface p-2 text-xs font-medium text-ink">CSV exports</p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-dark underline-offset-4 hover:underline">
      {children} <span aria-hidden>→</span>
    </Link>
  );
}

function Setup() {
  return (
    <section id="how" aria-labelledby="setup-heading" className="scroll-mt-16 border-y border-line bg-card">
      <div className={`${CONTAINER} py-14 sm:py-20`}>
        <p className={EYEBROW}>How it works</p>
        <h2 id="setup-heading" className={`${HEADING} mt-3`}>One widget for both.</h2>
        <ol className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-3">
          {SETUP_STEPS.map(({ icon, title, body }, index) => (
            <li key={title} className="border-t border-line pt-5">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-clay-tint text-clay-dark">
                  <SupportIcon name={icon} className="h-4 w-4" />
                </span>
                <span className="font-mono text-xs text-faint">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Developer() {
  return (
    <section id="integrate" aria-labelledby="integration-heading" className={`${CONTAINER} scroll-mt-16 pt-16 sm:pt-24`}>
      <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className={EYEBROW}>Integrate</p>
          <h2 id="integration-heading" className={`${HEADING} mt-3`}>Add Upstep to your app.</h2>
          <p className="mt-4 max-w-sm leading-relaxed text-muted">
            Use one script tag on your website or integrate with a JavaScript, React, React Native or Flutter SDK.
          </p>
          <TextLink href="/guides">Browse developer guides</TextLink>
        </div>
        <div className="min-w-0"><CodeShowcase /></div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article id="mcp" className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ink">Built-in MCP server</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">Connect Codex, Claude Code or Cursor to your board so your coding agent can triage feedback, update tasks and post replies.</p>
          <TextLink href="/guides/product-feedback-mcp">Connect an MCP client</TextLink>
        </article>
        <article id="open-source" className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ink">Open source and self-hostable</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">Run the dashboard, support inbox, feedback boards and MCP server on your own infrastructure with Docker Compose.</p>
          <TextLink href="https://github.com/TheBugEater/upstep#self-host-in-two-minutes">View self-hosting docs</TextLink>
        </article>
      </div>
    </section>
  );
}

function Questions() {
  return (
    <section aria-labelledby="faq-heading" className="border-y border-line bg-card">
      <div className={`${CONTAINER} grid gap-7 py-14 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
        <h2 id="faq-heading" className={HEADING}>Common questions.</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQS.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-ink hover:text-clay-dark [&::-webkit-details-marker]:hidden">
                {question}
                <SupportIcon name="chevron" className="h-4 w-4 shrink-0 text-clay-dark group-open:rotate-180" />
              </summary>
              <p className="pb-4 pr-5 text-sm leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section aria-labelledby="get-started-heading" className={`${CONTAINER} py-14 sm:py-20`}>
      <div className="grid items-center gap-x-12 rounded-3xl bg-[#2a1d17] bg-[radial-gradient(ellipse_at_100%_110%,#673420,transparent_65%)] p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <h2 id="get-started-heading" className="text-4xl leading-tight tracking-[-0.05em] text-white sm:text-5xl">Bring Upstep to your product.</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#ead4c9]">Start collecting feedback for free. Add Chat Support on Pro or Business.</p>
        </div>
        <div className="lg:[&>form]:mt-0"><StartForm inverse /></div>
      </div>
    </section>
  );
}
