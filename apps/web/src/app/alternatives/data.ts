export type Feature = { label: string; upstep: boolean; them: boolean };

export type Competitor = {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  theirPitch: string;
  painPoints: string[];
  features: Feature[];
  verdict: string;
};

export const COMPETITORS: Record<string, Competitor> = {
  canny: {
    slug: "canny",
    name: "Canny",
    headline: "The Canny alternative built for developers",
    intro:
      "Canny is a popular feedback board tool aimed at product teams. It works well for public roadmaps — but if you need to embed a widget directly inside your app and let users vote without leaving, it falls short. Upstep was built specifically for that workflow.",
    theirPitch:
      "Canny hosts your feedback on a separate board (canny.io/your-company). Users leave your app, submit feedback, and return. There is no native embed SDK for your product UI.",
    painPoints: [
      "No embeddable widget — users are redirected to an external board",
      "Per-seat pricing scales poorly for small teams",
      "No React Native SDK for mobile apps",
      "Free tier limited to 200 tracked users with Canny branding",
      "Requires a separate subdomain, adding friction for users",
    ],
    features: [
      { label: "Embeddable widget (no redirect)", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
      { label: "Free plan (no credit card)", upstep: true, them: true },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "White-label (remove branding)", upstep: true, them: false },
    ],
    verdict:
      "If you want a public roadmap board, Canny is a solid choice. If you want feedback to live inside your product — a widget your users can open without leaving your app — Upstep is the better fit, and it starts free.",
  },

  uservoice: {
    slug: "uservoice",
    name: "UserVoice",
    headline: "The UserVoice alternative that's actually affordable",
    intro:
      "UserVoice is one of the oldest feedback tools in the market, built for enterprise customer success teams. Its pricing starts at $699/month and the integration story is built around support portals, not developer SDKs. Upstep gives you the same core loop — collect, vote, ship — without the enterprise overhead.",
    theirPitch:
      "UserVoice targets enterprise product and customer success teams with features like NPS surveys, CRM integrations, and account-level segmentation. It is a powerful platform, but the minimum contract is far out of reach for indie developers, startups, or small teams.",
    painPoints: [
      "Pricing starts at $699/month — no free tier for small teams",
      "Complex setup requires CS team onboarding",
      "No lightweight embeddable widget; portal-first approach",
      "Overkill for teams that just need a feedback widget",
      "Long sales cycle before you can even try the product",
    ],
    features: [
      { label: "Free plan available", upstep: true, them: false },
      { label: "Embeddable in-app widget", upstep: true, them: false },
      { label: "React / JS / React Native SDK", upstep: true, them: false },
      { label: "User voting", upstep: true, them: true },
      { label: "Self-serve signup", upstep: true, them: false },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "No annual contract required", upstep: true, them: false },
    ],
    verdict:
      "UserVoice is built for enterprise teams with six-figure budgets and dedicated customer success teams. If you're a developer or small team that wants to start collecting feedback today — free, embedded, and without a sales call — Upstep is the answer.",
  },

  productboard: {
    slug: "productboard",
    name: "Productboard",
    headline: "The Productboard alternative for feedback collection",
    intro:
      "Productboard is a full product management platform: roadmaps, prioritization frameworks, OKR alignment, and more. If you need all of that, it's a strong tool. But most developers don't — they need a widget that collects feedback and surfaces what users actually want. Upstep does exactly that, for free.",
    theirPitch:
      "Productboard charges per maker (editor) seat, starting around $20/month per user. A team of five would pay $100/month before collecting a single piece of feedback. The platform requires significant setup and training to get value from its prioritization features.",
    painPoints: [
      "Per-seat pricing — a team of 5 pays $100+/month",
      "Feedback collection is a small part of a large, complex platform",
      "No lightweight embeddable widget for end-user apps",
      "Requires onboarding and workflow setup before use",
      "No mobile SDK for React Native apps",
    ],
    features: [
      { label: "Free plan available", upstep: true, them: false },
      { label: "Embeddable in-app feedback widget", upstep: true, them: false },
      { label: "End-user voting on feedback", upstep: true, them: true },
      { label: "React Native mobile SDK", upstep: true, them: false },
      { label: "2-line code setup", upstep: true, them: false },
      { label: "Bug report + feature request types", upstep: true, them: true },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "No per-seat pricing", upstep: true, them: false },
    ],
    verdict:
      "Productboard is a product management suite. If you just need a feedback widget that slots into your app, lets users vote, and surfaces what to build next, Upstep gets you there in minutes — not sprints.",
  },

  featurebase: {
    slug: "featurebase",
    name: "Featurebase",
    headline: "The Featurebase alternative without the per-seat meter",
    intro:
      "Featurebase bundles a support inbox, live chat, and AI resolution agent together with feedback boards and roadmaps. That's a lot of surface area if all you want is a widget your users can open to leave feedback and vote. Upstep does just that part, and starts free.",
    theirPitch:
      "Featurebase offers a free plan, then $29, $59, or $99 per seat per month, billed annually only. On top of the seat fee, every support conversation their AI agent resolves costs an extra $0.29 — a metered cost that scales with your support volume, not just your team size.",
    painPoints: [
      "Paid plans are annual-only — no monthly billing option",
      "$0.29 per AI-resolved conversation stacks on top of per-seat pricing",
      "Bundles a full support inbox and live chat you may not need just for feedback",
      "No dedicated React Native SDK for mobile apps",
      "Discounted startup pricing only applies to companies under 2 years old with fewer than 6 employees",
    ],
    features: [
      { label: "Embeddable widget (no redirect)", upstep: true, them: true },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "Monthly billing available", upstep: true, them: false },
      { label: "No per-resolution metering", upstep: true, them: false },
      { label: "No per-seat pricing", upstep: true, them: false },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Free plan (no credit card)", upstep: true, them: true },
    ],
    verdict:
      "Featurebase makes sense if you want to replace your entire support stack — inbox, live chat, and feedback — under one per-seat bill. If you just need a lightweight widget for feedback and votes without a metered AI fee running in the background, Upstep is simpler and free to start.",
  },

  frill: {
    slug: "frill",
    name: "Frill",
    headline: "The Frill alternative with a real free plan",
    intro:
      "Frill packages feedback, a public roadmap, and changelog announcements into one clean product. It's a solid tool — but there's no free tier, ideas are capped on the entry plan, and removing Frill's own branding costs extra even after you're paying. Upstep starts free with white-labeling included.",
    theirPitch:
      "Frill's cheapest plan is $25/month for 50 ideas and a single survey. Unlimited ideas require the $49/month Business plan, and white-labeling isn't bundled in until the $149/month Growth plan (or as a separate paid add-on on the cheaper tiers).",
    painPoints: [
      "No free plan — paid tiers start at $25/month after a 14-day trial",
      "Entry plan caps you at 50 ideas",
      "White-label branding removal requires the $149/month plan or a paid add-on",
      "No dedicated React Native SDK for mobile apps",
      "Enterprise features (SOC2, audit logs) start at $349/month",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "White-label included on entry plan", upstep: true, them: false },
      { label: "Unlimited feedback on entry plan", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Public roadmap + widget together", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
    ],
    verdict:
      "Frill is a well-designed tool once you're paying for it. If you want to start collecting feedback today without a credit card, and keep your own branding without an upsell, Upstep gets you there free.",
  },

  upvoty: {
    slug: "upvoty",
    name: "Upvoty",
    headline: "The Upvoty alternative that doesn't cap you by project",
    intro:
      "Upvoty is a focused, embeddable feedback and roadmap tool for SaaS teams — lightweight and easy for end users. Its pricing scales by number of projects rather than seats, which becomes an odd constraint once you're running more than one app. Upstep's free plan has no project-count tax.",
    theirPitch:
      "Upvoty starts at $25/month (Power) for a single project, rising to $49/month (Super) and $99/month (Hyper) as you add projects. Every tier includes unlimited users, custom domains, SSO, and integrations — the project cap is the main lever.",
    painPoints: [
      "No free plan — every tier is a paid monthly subscription",
      "Pricing scales by project count, not usage or team size",
      "Running two apps means either sharing a project or paying for a higher tier",
      "No dedicated React Native SDK for mobile apps",
      "SSO is bundled into every paid tier, which you're paying for whether you need it or not",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "Multiple projects on the free tier", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Embeddable widget (no redirect)", upstep: true, them: true },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Status tracking (open/in progress/done)", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
    ],
    verdict:
      "Upvoty is a clean, purpose-built tool if you're running one product and don't mind the monthly fee. If you want to start free — or you're running more than one app — Upstep doesn't charge you per project.",
  },

  nolt: {
    slug: "nolt",
    name: "Nolt",
    headline: "The Nolt alternative that doesn't charge per board",
    intro:
      "Nolt is a lightweight, no-frills feedback board — a solid choice if a hosted public board is all you need. It doesn't ship a React or React Native SDK, and its pricing scales by the number of boards you run. Upstep gives you an embeddable widget and a free plan instead.",
    theirPitch:
      "Nolt starts at $29/month for a single board (Essential), rising to $69/month for up to 5 boards (Pro). A 10-day trial of the Pro plan is available without a credit card, and Enterprise pricing is quote-only.",
    painPoints: [
      "No free plan — paid tiers start at $29/month after the trial",
      "Pricing scales by board count, awkward once you have a few apps or teams",
      "Boards are hosted pages, not an SDK you embed directly in your product UI",
      "No dedicated React Native SDK for mobile apps",
      "Password-protected/domain-restricted boards require the $69/month Pro plan",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "Embeddable widget in your own UI", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "No per-board pricing", upstep: true, them: false },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Public roadmap", upstep: true, them: true },
      { label: "Custom statuses", upstep: true, them: true },
    ],
    verdict:
      "Nolt does one thing well: a clean, hosted feedback board. If you want that feedback loop living inside your product instead of a separate page — and you want to start for free — Upstep is the closer fit.",
  },

  sleekplan: {
    slug: "sleekplan",
    name: "Sleekplan",
    headline: "The Sleekplan alternative with no workspace ceiling",
    intro:
      "Sleekplan is one of the more affordable hosted feedback tools, starting at $13/month for a board, changelog, and widget. It's a fair deal — but it's still a paid-from-day-one product with per-workspace pricing. Upstep gives you the same widget-plus-voting loop for free.",
    theirPitch:
      "Sleekplan's Indie plan starts at $13/month, scaling up to $63/month as you add features and usage. Pricing is per workspace, and a 30-day trial is available with no credit card required up front.",
    painPoints: [
      "No permanently free tier — the Indie plan is the cheapest paid option",
      "Pricing is per workspace, so multiple products mean multiple bills",
      "No dedicated React Native SDK for mobile apps",
      "Advanced privacy and branding controls are gated to higher tiers",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "No per-workspace pricing", upstep: true, them: false },
      { label: "Embeddable widget (unlimited placements)", upstep: true, them: true },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Public roadmap + changelog", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
    ],
    verdict:
      "Sleekplan is good value if you're already committed to paying for a feedback tool. If you'd rather not pay until you outgrow a free plan, Upstep covers the same core loop — widget, votes, statuses — at no cost to start.",
  },

  hellonext: {
    slug: "hellonext",
    name: "Hellonext",
    headline: "The Hellonext alternative for teams that just want a widget",
    intro:
      "Hellonext bundles feedback boards, roadmaps, a changelog, a knowledge base, product analytics, and a CRM into one platform. That breadth is the appeal — and the problem, if all you actually need is a feedback widget and a place for users to vote.",
    theirPitch:
      "Hellonext's \"Take Flight\" plan is $49/month for its full feedback feature set, with \"Fly High\" at $99/month unlocking more customization. A 14-day free trial is available, after which a paid plan is required.",
    painPoints: [
      "No free plan — the trial converts to a $49+/month subscription",
      "Bundles a CRM, knowledge base, and analytics you may never touch",
      "No dedicated React Native SDK for mobile apps",
      "Deeper customization is locked behind the $99/month tier",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Focused widget (no bundled CRM/KB)", upstep: true, them: false },
      { label: "Embeddable widget (no redirect)", upstep: true, them: true },
      { label: "User voting on feedback", upstep: true, them: true },
      { label: "Slack & webhook integrations", upstep: true, them: true },
      { label: "Bug report + feature request types", upstep: true, them: true },
    ],
    verdict:
      "Hellonext is built for teams that want feedback folded into a broader customer-ops platform. If you want the feedback widget without the rest of the suite — and without the monthly bill — Upstep is the leaner choice.",
  },

  usersnap: {
    slug: "usersnap",
    name: "Usersnap",
    headline: "The Usersnap alternative built for feature voting, not just bug capture",
    intro:
      "Usersnap is a strong tool for visual bug reports — annotated screenshots, screen recordings, and console metadata attached automatically. But it's priced and built for QA-style capture, not public feature voting, and it starts at $99/month with no free tier.",
    theirPitch:
      "Usersnap starts at $99/month (Startup, 10 members / 5 projects), rising to $189/month (Company) and $329/month (Premium). A 15-day free trial is available with no credit card required.",
    painPoints: [
      "No free plan — entry pricing starts at $99/month",
      "Built primarily for visual bug capture, not public feature voting and roadmaps",
      "Team and project counts are capped per tier",
      "No dedicated React Native SDK for mobile apps",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "Public feature voting", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Bug report + feature request in one widget", upstep: true, them: true },
      { label: "Embeddable widget (no redirect)", upstep: true, them: true },
      { label: "Third-party integrations (Jira, Slack, etc.)", upstep: true, them: true },
      { label: "Status tracking (open/in progress/done)", upstep: true, them: true },
    ],
    verdict:
      "If your priority is annotated bug screenshots for QA, Usersnap is purpose-built for that. If you want bug reports and feature voting living in the same free widget, Upstep covers both without the $99/month floor.",
  },

  "marker-io": {
    slug: "marker-io",
    name: "Marker.io",
    headline: "The Marker.io alternative that includes feature voting",
    intro:
      "Marker.io is a well-regarded visual bug-reporting tool for QA teams and client sign-off — screen recordings, console logs, and Jira-ready tickets. It's not built for public feature requests or user voting, and there's no free plan.",
    theirPitch:
      "Marker.io starts at $39/month (Starter, 3 users), rising to $149/month (Team, 15 users) and $499/month (Business, 50 users). All plans include unlimited websites, projects, and guest reporters. A 15-day free trial is available.",
    painPoints: [
      "No free plan — pricing starts at $39/month",
      "Built for internal QA bug capture, not public feature request voting",
      "User seats are capped per tier ($499/month for 50 users)",
      "No dedicated React Native SDK for mobile apps",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "Public feature voting", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Bug report + feature request in one widget", upstep: true, them: false },
      { label: "Embeddable widget (no redirect)", upstep: true, them: true },
      { label: "Unlimited guest reporters", upstep: true, them: true },
      { label: "Webhook integrations", upstep: true, them: true },
    ],
    verdict:
      "Marker.io is a great fit for internal QA workflows and client sign-off on visual bugs. If you also want end users to submit and vote on feature ideas, in the same widget, without a per-seat bill, Upstep does both from a free plan.",
  },

  beamer: {
    slug: "beamer",
    name: "Beamer",
    headline: "The Beamer alternative where feedback isn't a paid add-on",
    intro:
      "Beamer is a solid changelog and in-app announcement tool — but feedback collection is a separate paid add-on layered on top of MAU-capped pricing, not a core feature. Upstep is built around feedback and voting from the ground up, and it's free.",
    theirPitch:
      "Beamer's Starter plan is $49/month (annual billing) for 5,000 monthly active users, rising to $99/month (10,000 MAU) and $249/month (50,000 MAU). Feedback and NPS are separate add-ons — the Feedback add-on alone is $99/month on top of the base plan, and there's still no public upvoting board or structured prioritization.",
    painPoints: [
      "Feedback is a $99/month add-on, not included in the base price",
      "Every tier is capped by monthly active users, forcing upgrades as you grow",
      "No public upvoting board or feature prioritization, even with the add-on",
      "No dedicated React Native SDK for mobile apps",
      "Paid plans are annual-billing only",
    ],
    features: [
      { label: "Free plan (no credit card)", upstep: true, them: false },
      { label: "Feedback + voting included, not an add-on", upstep: true, them: false },
      { label: "No MAU-based pricing caps", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "Public feature voting", upstep: true, them: false },
      { label: "In-app widget", upstep: true, them: true },
      { label: "Status tracking (open/in progress/done)", upstep: true, them: true },
    ],
    verdict:
      "Beamer is built first for changelogs and announcements, with feedback bolted on as a paid extra. If feedback and voting are the point — not an add-on — Upstep gives you that as the core product, free to start.",
  },

  fider: {
    slug: "fider",
    name: "Fider",
    headline: "The Fider alternative with no server to run",
    intro:
      "Fider is a genuinely good open-source feedback portal — AGPL-licensed, self-hostable with Docker and Postgres, with a real community behind it. The tradeoff is exactly what you'd expect from self-hosted software: you own the deployment, the uptime, and the updates. Upstep gives you the same public-board-plus-voting loop as a managed service, plus SDKs for embedding it directly in your product.",
    theirPitch:
      "Fider's core feedback portal — public boards, upvoting, status tracking, REST API, and OAuth login — is free and open-source under AGPL-3.0. Running it means self-hosting with Docker and PostgreSQL yourself, or paying for a managed cloud instance; some capabilities like content moderation and search indexing are reserved for the paid tier.",
    painPoints: [
      "Self-hosting means you own uptime, backups, and Postgres/Docker maintenance",
      "No embeddable widget or React/React Native SDK — it's a standalone hosted portal",
      "Content moderation and search indexing are gated behind the paid tier",
      "No managed free tier — it's either self-hosted or a paid cloud plan",
    ],
    features: [
      { label: "Embeddable widget (no redirect)", upstep: true, them: false },
      { label: "React Native / mobile SDK", upstep: true, them: false },
      { label: "2-line code integration", upstep: true, them: false },
      { label: "No hosting or Docker/Postgres to maintain", upstep: true, them: false },
      { label: "Free managed plan", upstep: true, them: false },
      { label: "Public board + upvoting", upstep: true, them: true },
      { label: "REST API & webhooks", upstep: true, them: true },
      { label: "OAuth login for end users", upstep: true, them: true },
    ],
    verdict:
      "Fider is a genuinely solid choice if you want full control and don't mind running the server yourself. If you'd rather drop in a widget and skip the ops work — with a managed free plan — Upstep gets you there without a Docker Compose file.",
  },
};
