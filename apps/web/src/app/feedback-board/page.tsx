import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Feedback Board for Product Teams",
  description:
    "Collect product feedback, let users vote on requests, and keep a clear status board inside your app. Upstep is a developer-first feedback board for web and mobile products.",
  alternates: { canonical: "/feedback-board" },
  openGraph: {
    title: "Feedback Board for Product Teams | Upstep",
    description:
      "An in-app feedback board for collecting requests, voting on what matters, and closing the loop with users.",
    url: "/feedback-board",
    images: ["/opengraph-image"],
  },
};

const faqs = [
  {
    question: "What is a feedback board?",
    answer:
      "A feedback board is a shared place where users can submit ideas, report problems, see requests that already exist, and vote on the ones that matter most. It gives product teams one ranked view of demand instead of a collection of disconnected support conversations.",
  },
  {
    question: "Should a feedback board be public?",
    answer:
      "Not always. A public board can build trust and reduce duplicate requests, while an in-app board is often better for customer products, internal tools, or betas. The important part is that people can see existing requests and add their vote before creating a duplicate.",
  },
  {
    question: "How is a feedback board different from a roadmap?",
    answer:
      "A feedback board captures demand: what people ask for and how many people support it. A roadmap communicates decisions: what your team is planning, building, or has shipped. Use the board as input to prioritisation, then promote selected work to the roadmap.",
  },
  {
    question: "Can I add a feedback board to a React Native or Flutter app?",
    answer:
      "Yes. Upstep has dedicated React Native and Flutter SDKs, plus JavaScript and React options for web apps. Feedback from every client can arrive in the same project, so mobile and web users do not end up in separate backlogs.",
  },
];

export default function FeedbackBoardPage() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Upstep",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        url: "https://upstep.dev/feedback-board",
        description:
          "An in-app feedback board for collecting product feedback, voting on requests, and keeping users informed.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={ld} />
      <Nav />

      <main>
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.14em] text-clay">
              Product feedback, in one place
            </span>
            <h1 className="font-serif text-5xl sm:text-6xl tracking-tight text-ink leading-[1.04] mt-4">
              A feedback board your users will actually use
            </h1>
            <p className="text-lg sm:text-xl text-muted leading-relaxed mt-7 max-w-2xl">
              Collect ideas and bug reports inside your product, let people vote on what they need,
              and give your team one clear signal for what to build next. No detour to a separate portal.
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <Link href="/login" className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-6 py-3 text-sm font-semibold hover:bg-clay-hover transition shadow-soft">
                Create a free feedback board <span aria-hidden>→</span>
              </Link>
              <Link href="/guides/feedback-widget-nextjs" className="inline-flex items-center gap-2 border border-line bg-card text-ink rounded-full px-6 py-3 text-sm font-semibold hover:bg-surface transition">
                See a Next.js integration
              </Link>
            </div>
            <p className="mt-4 text-xs text-faint">Free plan · No credit card · Web, React Native, and Flutter SDKs</p>
          </div>

          <div className="mt-14 grid md:grid-cols-[1.2fr_.8fr] gap-5 rounded-3xl border border-line bg-card p-5 sm:p-7 shadow-lift">
            <div className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div><p className="font-semibold text-ink">Product feedback</p><p className="text-xs text-muted mt-1">Sorted by customer demand</p></div>
                <span className="text-xs font-medium rounded-full bg-clay/10 text-clay px-3 py-1">Open</span>
              </div>
              <BoardItem title="Add saved filters to the dashboard" votes="42" status="Most requested" />
              <BoardItem title="Export a project summary as CSV" votes="19" status="Under review" />
              <BoardItem title="Report an issue from the mobile app" votes="12" status="New" />
            </div>
            <div className="rounded-2xl bg-clay/5 border border-clay/15 p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">The loop</p>
                <ol className="mt-5 space-y-4 text-sm text-ink-soft">
                  <li><strong className="text-ink">1. Capture.</strong> Put a lightweight entry point where users already work.</li>
                  <li><strong className="text-ink">2. Consolidate.</strong> Show similar requests before a new one is created.</li>
                  <li><strong className="text-ink">3. Prioritise.</strong> Use votes as one input alongside strategy and effort.</li>
                  <li><strong className="text-ink">4. Close the loop.</strong> Move work through statuses so people can see progress.</li>
                </ol>
              </div>
              <p className="mt-8 text-sm text-muted">A board is not a promise to build everything. It is a dependable record of what customers need.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20 grid lg:grid-cols-[.8fr_1.2fr] gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Why teams need one</p>
              <h2 className="font-serif text-3xl sm:text-4xl text-ink mt-4 leading-tight">The problem is not a lack of feedback. It is feedback with no shared home.</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Problem title="Duplicate requests hide demand" body="When each request lives in a separate ticket, email, or Slack thread, nobody can tell whether a request is one person’s opinion or a recurring need." />
              <Problem title="Votes make demand visible" body="A vote does not replace product judgement, but it gives the team a concrete signal to weigh against reach, effort, and strategy." />
              <Problem title="In-app collection removes friction" body="Users are much more likely to leave useful context if feedback starts in the product instead of on a generic external portal." />
              <Problem title="Statuses build trust" body="A small amount of visibility—open, planned, in progress, done—shows people their input has not disappeared into a black hole." />
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Built for the actual workflow</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-ink mt-4">From a user&apos;s thought to a better product decision</h2>
            <p className="mt-5 text-muted leading-relaxed">Upstep is deliberately focused: capture feedback, group the signal, let users vote, and help the team move work forward. You can run the feedback board in the product users already know rather than training them to visit another destination.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            <Feature title="A native feeling entry point" body="Use the floating launcher, your own button in a help menu, or a custom trigger. The feedback experience can match the rest of your app." linkText="Add it to a Next.js app" href="/guides/feedback-widget-nextjs" />
            <Feature title="One board across every client" body="Web, React Native, and Flutter submissions can flow into the same project. Customers do not need to know which platform they used to find their request." linkText="Set up React Native" href="/guides/feedback-widget-react-native" />
            <Feature title="A useful handoff to your team" body="Keep bugs, feature requests, and general feedback together, then use statuses, comments, webhooks, and the MCP server to move the important work into your normal flow." linkText="Explore developer integrations" href="/integrations" />
          </div>
        </section>

        <section className="bg-ink text-white">
          <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24 grid lg:grid-cols-[.8fr_1.2fr] gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Use it with intent</p>
              <h2 className="font-serif text-3xl sm:text-4xl mt-4 leading-tight">A good feedback board is not an unfiltered feature-request dump.</h2>
            </div>
            <div className="space-y-6 text-white/75 leading-relaxed">
              <p><strong className="text-white">Ask for context, not just ideas.</strong> A concise prompt such as “What were you trying to do?” produces better input than a blank text box. For bugs, ask for the expected outcome and the point where the user got stuck.</p>
              <p><strong className="text-white">Make duplicates visible.</strong> Show relevant ideas before submission and give people a quick way to vote. This keeps the board readable and makes vote counts meaningful.</p>
              <p><strong className="text-white">Review the signal on a cadence.</strong> Someone should own a weekly or fortnightly pass: group repeats, update statuses, and bring the strongest evidence into planning. A board without follow-through quickly loses trust.</p>
              <Link href="/guides/product-feedback-triage" className="inline-flex text-clay hover:text-white transition font-medium">Read the feedback triage guide →</Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Choose the right shape</p>
              <h2 className="font-serif text-3xl sm:text-4xl text-ink mt-4">Feedback board, roadmap, or support inbox?</h2>
              <p className="mt-5 text-muted leading-relaxed">Most product teams need all three eventually. They serve different jobs, and trying to make one tool do each job usually creates clutter.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-line shadow-soft">
              <table className="min-w-[580px] w-full text-sm">
                <thead className="bg-surface text-left"><tr><th className="px-5 py-4 text-xs uppercase tracking-wide text-muted">Surface</th><th className="px-5 py-4 text-xs uppercase tracking-wide text-muted">Primary job</th><th className="px-5 py-4 text-xs uppercase tracking-wide text-muted">Best signal</th></tr></thead>
                <tbody className="divide-y divide-line bg-card text-ink-soft">
                  <tr><td className="px-5 py-4 font-medium text-ink">Feedback board</td><td className="px-5 py-4">Capture and consolidate demand</td><td className="px-5 py-4">Requests, duplicates, and votes</td></tr>
                  <tr><td className="px-5 py-4 font-medium text-ink">Roadmap</td><td className="px-5 py-4">Communicate decisions and direction</td><td className="px-5 py-4">What is planned, active, and shipped</td></tr>
                  <tr><td className="px-5 py-4 font-medium text-ink">Support inbox</td><td className="px-5 py-4">Resolve individual customer issues</td><td className="px-5 py-4">Account context and response time</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="max-w-3xl mx-auto px-6 py-20 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Frequently asked questions</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-ink mt-4 mb-10">Feedback board FAQs</h2>
            <div className="divide-y divide-line border-y border-line">
              {faqs.map((faq) => <details key={faq.question} className="group py-5"><summary className="cursor-pointer list-none flex justify-between gap-4 font-medium text-ink"><span>{faq.question}</span><span className="text-clay group-open:rotate-45 transition">+</span></summary><p className="mt-3 pr-8 text-sm leading-7 text-muted">{faq.answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          <h2 className="font-serif text-4xl sm:text-5xl text-ink">Give product feedback a home.</h2>
          <p className="max-w-xl mx-auto mt-5 text-lg text-muted leading-relaxed">Start with a free project, put the board in front of real users, and make the next product decision with better evidence.</p>
          <Link href="/login" className="inline-flex items-center gap-2 mt-9 bg-clay text-white rounded-full px-7 py-3.5 text-sm font-semibold hover:bg-clay-hover transition shadow-soft">Create your feedback board <span aria-hidden>→</span></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function BoardItem({ title, votes, status }: { title: string; votes: string; status: string }) {
  return <div className="flex items-center gap-3 py-4 border-b last:border-0 border-line"><span className="shrink-0 rounded-lg border border-line bg-card px-2 py-1 text-xs font-semibold text-clay">↑ {votes}</span><p className="min-w-0 flex-1 text-sm font-medium text-ink">{title}</p><span className="hidden sm:inline text-xs text-muted">{status}</span></div>;
}

function Problem({ title, body }: { title: string; body: string }) {
  return <article className="rounded-2xl border border-line bg-card p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{body}</p></article>;
}

function Feature({ title, body, linkText, href }: { title: string; body: string; linkText: string; href: string }) {
  return <article className="rounded-2xl border border-line bg-card p-6 shadow-soft"><h3 className="font-serif text-xl text-ink">{title}</h3><p className="mt-3 text-sm leading-7 text-muted">{body}</p><Link href={href} className="inline-flex mt-5 text-sm font-medium text-clay hover:text-clay-hover transition">{linkText} →</Link></article>;
}
