export type Benefit = { title: string; body: string };

export type UseCase = {
  slug: string;
  audience: string;
  headline: string;
  intro: string;
  challenges: string[];
  benefits: Benefit[];
  ctaNote: string;
};

export const USE_CASES: Record<string, UseCase> = {
  saas: {
    slug: "saas",
    audience: "SaaS teams",
    headline: "Feedback and voting for SaaS products",
    intro:
      "SaaS teams live and die by knowing what to build next. Upstep puts a feedback widget directly in your product so requests, bugs, and votes land in one triaged backlog instead of scattered across email and Slack DMs.",
    challenges: [
      "Feature requests arrive through support tickets, Slack, and DMs with no single source of truth",
      "No easy way for users to see what's already been requested, so the same idea gets submitted five times",
      "Prioritization is guesswork without a vote count behind each idea",
    ],
    benefits: [
      { title: "One backlog, not five inboxes", body: "Bug reports, feature requests, and general feedback all land in the same dashboard, sorted by votes." },
      { title: "Users see what's already requested", body: "The vote tab shows existing ideas before someone submits a duplicate." },
      { title: "Ship, then close the loop", body: "Move items through Open → In Progress → Done and commenters get visibility into what happened to their idea." },
    ],
    ctaNote: "Free plan covers your first project, no credit card, no sales call.",
  },

  "mobile-apps": {
    slug: "mobile-apps",
    audience: "mobile app teams",
    headline: "Feedback SDK for iOS and Android apps",
    intro:
      "Mobile users don't file GitHub issues, they delete the app. Upstep's React Native SDK gives them a native feedback sheet and an optional shake-to-report gesture, so a frustrated user has somewhere to go besides the app store review box.",
    challenges: [
      "App store reviews are the only feedback channel most users have, and a 1-star review doesn't tell you what broke",
      "No easy way to attach context (which screen, which action) to a bug report from a phone",
      "Building your own in-app feedback UI means native code on two platforms",
    ],
    benefits: [
      { title: "Native feedback sheet, not a web view", body: "The React Native SDK renders real native components. FeedbackButton and FeedbackSheet, not an embedded browser." },
      { title: "Shake-to-report", body: "The useShakeToFeedback hook lets frustrated users open the feedback sheet with a shake, no button hunting." },
      { title: "Works in Expo, no native linking", body: "The SDK has no custom native modules beyond react-native-safe-area-context, so it installs cleanly in managed Expo projects." },
    ],
    ctaNote: "Free plan available, install the SDK and you're live in minutes.",
  },

  "indie-hackers": {
    slug: "indie-hackers",
    audience: "indie hackers",
    headline: "Feedback widget for indie hackers",
    intro:
      "You're building solo or with one co-founder, you don't have time to build a feedback system, and you definitely don't have budget for a $49/month tool with a sales call attached. Upstep is a free plan and two lines of code.",
    challenges: [
      "No time to build a custom feedback form and admin view from scratch",
      "Most feedback tools assume a team and a budget you don't have yet",
      "Feedback that does come in via DMs and emails gets lost within a week",
    ],
    benefits: [
      { title: "Free plan, real feature set", body: "Voting, statuses, and the widget itself aren't locked behind a paywall, they're on the free plan." },
      { title: "2-line integration", body: "Install the package, paste your API key, done. No backend to stand up." },
      { title: "One project is usually enough", body: "Ship your first product, collect real feedback, and upgrade only if you actually need more projects." },
    ],
    ctaNote: "No credit card. Start collecting feedback on your side project today.",
  },

  startups: {
    slug: "startups",
    audience: "early-stage startups",
    headline: "Feedback widget for early-stage startups",
    intro:
      "Pre-seed and seed-stage teams need to move fast on the signal that matters, what early users are actually asking for. Upstep gives you that signal without a procurement process.",
    challenges: [
      "Enterprise feedback tools price for teams you don't have yet, with contracts you can't commit to",
      "Every week spent on internal tooling is a week not spent talking to users",
      "Investors and early customers both want to see you're listening and shipping",
    ],
    benefits: [
      { title: "Start free, upgrade when it's real", body: "No contract, no sales call, the free plan is enough to validate the feedback loop before you pay for anything." },
      { title: "Public voting doubles as social proof", body: "A visible, active feedback board signals to early users that someone's home and building." },
      { title: "Slack & webhook integrations", body: "Route new feedback straight into the channel your team already lives in." },
    ],
    ctaNote: "Free plan, 2-line integration, live before your next standup.",
  },

  "open-source": {
    slug: "open-source",
    audience: "open source maintainers",
    headline: "Feedback board for open source projects",
    intro:
      "GitHub Issues is built for bugs, not for surfacing which feature request your community actually wants most. A public voting board gives contributors and users a lightweight way to signal priority without opening yet another issue thread.",
    challenges: [
      "Feature requests get buried in a long, unsorted GitHub Issues backlog",
      "No native way for the community to vote on what matters most",
      "Duplicate requests pile up because there's no visibility into what's already been asked for",
    ],
    benefits: [
      { title: "A public board sorted by votes", body: "Contributors see the most-requested ideas first, instead of scrolling a chronological issue list." },
      { title: "Free plan, no strings", body: "Open source projects rarely have a budget line for tooling. Upstep's free plan doesn't require one." },
      { title: "Webhook integration", body: "Pipe new feedback into whatever you already use to track project work." },
    ],
    ctaNote: "Free to start, a good fit for a project with no ops budget.",
  },

  "internal-tools": {
    slug: "internal-tools",
    audience: "internal tools teams",
    headline: "Feedback widget for internal tools",
    intro:
      "The people using your internal dashboard are your own coworkers, and they'll tell you exactly what's broken if you give them a button to do it, instead of a Slack thread that gets lost.",
    challenges: [
      "Bug reports about internal tools arrive as one-off Slack messages with no context or history",
      "No visibility into which internal pain points are reported most often",
      "Building a custom internal feedback form isn't worth engineering time for a low-traffic tool",
    ],
    benefits: [
      { title: "2-line integration", body: "Drop the widget into an internal dashboard as fast as any customer-facing app, same SDK, same setup." },
      { title: "Bug, feature, and general feedback types", body: "Coworkers can flag what's broken separately from what they wish existed." },
      { title: "Free plan covers most internal tools", body: "Low-traffic internal apps rarely need more than the free tier." },
    ],
    ctaNote: "Set it up once, stop chasing bug reports through Slack.",
  },

  ecommerce: {
    slug: "ecommerce",
    audience: "online store owners",
    headline: "Feedback widget for online stores",
    intro:
      "Shoppers who hit a broken checkout or want a feature you don't have rarely email support, they just leave. A lightweight widget gives them somewhere to say so before they bounce.",
    challenges: [
      "No visibility into friction points customers hit but never report",
      "Feature requests ('add this payment method', 'let me save my size') go nowhere",
      "Most feedback tools assume a dev team, not a Shopify or Webflow theme",
    ],
    benefits: [
      { title: "One script tag, no dev team required", body: "Paste the embed into your theme.liquid or Webflow custom code, see the Shopify and Webflow integration guides." },
      { title: "Vote counts show what to prioritize", body: "See which requested feature or fix has the most customer demand before you build it." },
      { title: "Free plan available", body: "Start collecting storefront feedback without adding a new line item to your tool budget." },
    ],
    ctaNote: "No credit card, see the Shopify and Webflow setup guides to go live today.",
  },

  "developer-tools": {
    slug: "developer-tools",
    audience: "developer tools & API companies",
    headline: "Feedback widget for developer tools and APIs",
    intro:
      "Your users are developers, they'll give you precise, technical feedback if you put a widget in your docs or dashboard instead of routing them to a generic support form.",
    challenges: [
      "Developers file feedback in GitHub Discussions, Discord, and support tickets with no single view across all three",
      "No way to see which API pain point or missing SDK feature is requested most",
      "Generic feedback tools don't fit naturally into a docs site or CLI-adjacent dashboard",
    ],
    benefits: [
      { title: "Typed SDKs, same audience as your product", body: "React, vanilla JS, and React Native SDKs, the same kind of tooling your developer users already expect." },
      { title: "Bug vs. feature vs. general triage", body: "Separate \"the API returned a 500\" from \"please add a webhook for this event\" from day one." },
      { title: "Webhook integration", body: "Forward new feedback into your own issue tracker or internal tooling automatically." },
    ],
    ctaNote: "Free plan, 2-line integration, add it to your dashboard or docs site.",
  },

  "beta-testing": {
    slug: "beta-testing",
    audience: "beta testing programs",
    headline: "Feedback widget for beta testing programs",
    intro:
      "A beta program lives or dies on how easy it is for testers to report what they find. Upstep gives every tester a launcher button instead of a shared spreadsheet nobody updates.",
    challenges: [
      "Beta testers report bugs inconsistently, some email, some Slack, some say nothing at all",
      "No structured way to separate \"this is broken\" from \"this is missing\" feedback",
      "Tracking which bugs are fixed and looping back to the tester who reported it is manual work",
    ],
    benefits: [
      { title: "Bug and feature types built in", body: "Testers pick a type when they submit, so triage starts before it reaches your inbox." },
      { title: "Status tracking with visibility", body: "Move a report to Done and the tester who filed it can see it landed, no manual follow-up email." },
      { title: "Works in web and native betas", body: "Same core loop whether your beta is a web app, a TestFlight build, or an Expo preview." },
    ],
    ctaNote: "Free plan is plenty for a beta cohort, upgrade only if the program grows.",
  },

  "product-managers": {
    slug: "product-managers",
    audience: "product managers",
    headline: "Feedback and voting built for how PMs actually prioritize",
    intro:
      "You don't need a full product management suite to answer \"what should we build next\", you need real user demand, sorted by votes, next to the bugs blocking them.",
    challenges: [
      "Prioritization frameworks are only as good as the input feeding them, and most feedback never gets structured",
      "Stakeholders ask \"how many people actually want this\" and there's no number to point to",
      "Heavyweight product management suites take weeks to configure before they produce any signal",
    ],
    benefits: [
      { title: "Votes as a prioritization signal", body: "Every piece of feedback carries an upvote count you can point to in a roadmap conversation." },
      { title: "Live in minutes, not a rollout project", body: "No workflow configuration or maker-seat onboarding, install the widget and feedback starts flowing." },
      { title: "Status pipeline out of the box", body: "Open, In Progress, and Done columns are there from the first project you create." },
    ],
    ctaNote: "Free plan, a real backlog with real votes, running today.",
  },

  agencies: {
    slug: "agencies",
    audience: "agencies building client apps",
    headline: "White-label feedback widget for agencies",
    intro:
      "You're shipping products under your client's brand, not yours, a feedback widget with \"Powered by Upstep\" stamped on it doesn't fit. The Business plan removes Upstep branding entirely, so it looks like part of the product you built.",
    challenges: [
      "Client-facing tools need to look native to the client's brand, not a third-party vendor's",
      "Managing feedback across multiple client projects needs more than one project slot",
      "Clients want visibility into what their own users are requesting, without extra dev work from your team",
    ],
    benefits: [
      { title: "Business plan removes all Upstep branding", body: "The widget footer and modal read as part of your client's product, not a third-party tool." },
      { title: "One SDK across every client project", body: "React, vanilla JS, and React Native cover whatever stack each client is built on." },
      { title: "Free plan to prototype before you commit", body: "Try the widget on a client project for free before deciding whether to upgrade for white-labeling." },
    ],
    ctaNote: "Start on the free plan; upgrade to Business when you need branding removed.",
  },

  "no-code": {
    slug: "no-code",
    audience: "no-code builders",
    headline: "Feedback widget for no-code apps",
    intro:
      "You didn't write a backend, and you shouldn't have to write one just to collect feedback either. If your no-code tool can paste a script tag into your site's custom code settings, you can have a feedback widget live in minutes.",
    challenges: [
      "No-code platforms rarely have a built-in feedback and voting system",
      "Most feedback tools assume you have a codebase to install a package into",
      "Custom-code embeds need to be simple enough to paste once and forget",
    ],
    benefits: [
      { title: "One script tag, no package manager", body: "The vanilla JS widget is a single script tag with a data-api-key attribute, works anywhere you can paste custom code." },
      { title: "Webflow and WordPress guides", body: "Step-by-step setup for the two most common no-code/CMS platforms, with the exact settings screen to use." },
      { title: "Free plan available", body: "No credit card needed to see if the feedback loop is worth keeping." },
    ],
    ctaNote: "No dev team required, see the Webflow or WordPress integration guide to get started.",
  },

  "customer-support": {
    slug: "customer-support",
    audience: "customer support teams",
    headline: "Turn support conversations into a feedback backlog",
    intro:
      "Support agents hear the same feature requests and bug reports over and over, with no easy way to route that signal to whoever's building the product. Upstep gives support teams a shared backlog product can actually see.",
    challenges: [
      "Support tickets containing feature requests get closed and forgotten instead of routed to product",
      "No visibility for support agents into whether a reported bug is already being worked on",
      "Product and support teams end up working from two different, disconnected views of user pain",
    ],
    benefits: [
      { title: "One backlog both teams can see", body: "Support can check whether an issue is already tracked before promising a customer a fix date." },
      { title: "Status visibility closes the loop", body: "When an item moves to Done, support has a straight answer for the customer who originally reported it." },
      { title: "Slack & webhook integrations", body: "Route new feedback into the same channels your support team already monitors." },
    ],
    ctaNote: "Free plan, give support a real channel to hand off feedback to product.",
  },

  "side-projects": {
    slug: "side-projects",
    audience: "side projects",
    headline: "Feedback widget for side projects",
    intro:
      "A side project doesn't need a procurement process, it needs two lines of code and a free plan that doesn't expire before you find out if anyone cares about what you built.",
    challenges: [
      "Most feedback tools require a paid plan before you've validated anyone wants the product",
      "No time outside a day job to build a custom feedback system",
      "Feedback from the handful of early users who do show up needs somewhere to land besides a notes app",
    ],
    benefits: [
      { title: "Free plan, no time limit", body: "Collect feedback for as long as the project stays small, no trial countdown." },
      { title: "2-line integration", body: "Add it in the same evening you're already shipping a feature." },
      { title: "Vanilla JS or React", body: "Works whether your side project is a full React app or a single static HTML page." },
    ],
    ctaNote: "Free, fast, and built for projects that don't have a budget yet.",
  },

  marketplaces: {
    slug: "marketplaces",
    audience: "marketplace platforms",
    headline: "Feedback widget for two-sided marketplaces",
    intro:
      "Buyers and sellers on a marketplace want different things, and both sides will tell you what's missing if you ask. A single widget, mounted in both experiences, keeps that feedback in one place instead of two disconnected inboxes.",
    challenges: [
      "Buyer feedback and seller/vendor feedback usually arrive through completely separate channels",
      "No shared view of which side of the marketplace is asking for what",
      "Prioritizing between buyer-side and seller-side requests is guesswork without vote counts",
    ],
    benefits: [
      { title: "Mount the widget on both surfaces", body: "Use identify() to tag feedback by user, so you can see whether a request came from a buyer or seller account." },
      { title: "Votes surface real demand from each side", body: "Compare vote counts across buyer and seller feedback instead of guessing which side is louder." },
      { title: "One SDK, both experiences", body: "The same React or vanilla JS integration covers your buyer-facing site and your seller dashboard." },
    ],
    ctaNote: "Free plan, mount it on one side first, expand once it proves useful.",
  },

  nonprofits: {
    slug: "nonprofits",
    audience: "nonprofits",
    headline: "Feedback widget for nonprofit tools and apps",
    intro:
      "Nonprofits building a donor portal, volunteer app, or member tool rarely have budget for enterprise feedback software. Upstep's free plan gives you the same widget and voting loop without a line item.",
    challenges: [
      "Software budgets are tight, and most feedback tools assume a commercial customer",
      "Volunteers and donors will report friction if given an easy way to, but rarely email support",
      "Small teams can't spend engineering time building a custom feedback form",
    ],
    benefits: [
      { title: "Free plan, no catch", body: "The core widget, voting, and status tracking aren't a stripped-down trial, they're the real free tier." },
      { title: "2-line integration", body: "A small team can install this in an afternoon, no dedicated engineering sprint required." },
      { title: "Bug + feature triage from day one", body: "Separate \"the donation form is broken\" from \"please add this\" without building your own categorization." },
    ],
    ctaNote: "Free to start, built to fit a nonprofit's budget, not work around it.",
  },
};
