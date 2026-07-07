export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lang: string; code: string };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date
  tag: string;
  readMinutes: number;
  body: BlogBlock[];
};

export const BLOG_POSTS: Record<string, BlogPost> = {
  "why-we-built-upstep": {
    slug: "why-we-built-upstep",
    title: "Why we built Upstep",
    description:
      "Every feedback tool we tried either redirected users to a separate site or charged enterprise prices for a widget. So we built the one we wanted.",
    date: "2026-05-12",
    tag: "Company",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "We didn't set out to build a feedback tool. We set out to add a feedback button to a side project, and got frustrated enough by the options that we built our own instead.",
      },
      { type: "h2", text: "The gap" },
      {
        type: "p",
        text: "The hosted feedback boards (Canny, Nolt, Upvoty) are great if a public roadmap page is what you want, but they pull users out of your product to submit anything. The enterprise platforms (UserVoice, Productboard) solve real problems for big teams, but they start at hundreds of dollars a month and want a sales call before you've collected a single vote.",
      },
      {
        type: "p",
        text: "What we actually wanted was simpler: a button inside our own app, feedback that lands in a dashboard we control, and votes that sort themselves. Nobody was selling that as a starting point, only as an add-on once you were already paying for something bigger.",
      },
      { type: "h2", text: "What we shipped first" },
      {
        type: "p",
        text: "So the first version of Upstep was deliberately small: a React component, an API key, and a table in a database. Two lines of code to mount it, a free plan with no credit card, and a dashboard that just showed what came in, sorted by votes. No workflow builder, no onboarding call, nothing to configure before it worked.",
      },
      {
        type: "list",
        items: [
          "Embed directly in your product, no redirect to a hosted board",
          "Users vote once, deduplicated automatically",
          "A free plan that's actually usable, not a seven-day trial",
          "Nothing to host or maintain on your side",
        ],
      },
      { type: "h2", text: "What's next" },
      {
        type: "p",
        text: "That starting point hasn't changed, but the product around it has grown. Fluid triage boards, a built-in MCP server so an AI agent can work the inbox alongside you, and a redesign that we're genuinely proud to look at. Same free plan, same two lines of code to get started.",
      },
    ],
  },

  "the-new-upstep": {
    slug: "the-new-upstep",
    title: "A fresh coat of paint, and a fluid new board",
    description:
      "We rebuilt the whole product around a warmer palette, real dark mode, and a triage board that finally feels instant instead of clunky.",
    date: "2026-07-01",
    tag: "Product",
    readMinutes: 3,
    body: [
      {
        type: "p",
        text: "Upstep looked fine. It didn't feel like anything. This week we shipped a full redesign, top to bottom, landing page to dashboard, and it's live for every plan today.",
      },
      { type: "h2", text: "Dark mode, done properly" },
      {
        type: "p",
        text: "Every color in the app now runs through a small set of design tokens instead of hardcoded hex values, so flipping to dark mode is a single class on the page instead of a second design pass. It follows your system setting by default, and there's a toggle in the header if you'd rather choose.",
      },
      { type: "h2", text: "Boards that feel instant" },
      {
        type: "p",
        text: "Drag a card to a new column and it settles into place with a bit of spring instead of snapping. Vote counts climb instead of jumping. New cards drop in with a bit of life instead of just appearing. None of it changes what the board does, it just stops fighting you while you use it.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "If you already have a project, it's already running the new look. If you don't yet, the free plan takes about two minutes to set up.",
      },
    ],
  },

  "introducing-mcp-server": {
    slug: "introducing-mcp-server",
    title: "Introducing the Upstep MCP server",
    description:
      "Claude Code, Cursor, Windsurf, Copilot, or any MCP client can now triage your feedback inbox directly, and keep agent busywork off the board your users see.",
    date: "2026-07-03",
    tag: "Product",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "If an AI agent is already writing code in your editor, it should be able to read what your users are asking for too, without you copying feedback into a prompt by hand. Every Upstep project now ships a built-in MCP server that does exactly that.",
      },
      { type: "h2", text: "What it can do" },
      {
        type: "list",
        items: [
          "get_project_overview and list_feedback, so an agent can see what's open and what's winning by votes",
          "create_feedback, to file a task, defaulting to Dev-only so it never shows up in the public widget",
          "update_feedback, to move a card across your board by column name",
          "add_comment, to reply to the users who asked for it",
          "create_board, for a workspace that's entirely the agent's own",
        ],
      },
      {
        type: "p",
        text: "Connecting it is one command, scoped to a single project by its API key:",
      },
      {
        type: "code",
        lang: "bash",
        code: 'claude mcp add --transport http upstep https://upstep.dev/api/mcp \\\n  --header "Authorization: Bearer YOUR_API_KEY"',
      },
      { type: "h2", text: "Dev-only, by default" },
      {
        type: "p",
        text: "The part we spent the most time on isn't a tool call, it's a default. When an agent files a task through the MCP server, it lands as Dev-only unless told otherwise, hidden from the public widget. Your users see their feature requests and bug reports. They don't see your agent's internal refactor list. It can even run its own board entirely apart from the one you show visitors.",
      },
      { type: "h2", text: "Get connected" },
      {
        type: "p",
        text: "Open any project, head to the new MCP tab, and copy the command for Claude Code or the JSON config for Cursor and other clients. The setup guide walks through the same thing if you're wiring up the widget for the first time.",
      },
    ],
  },

  "triage-without-a-pm": {
    slug: "triage-without-a-pm",
    title: "Feature requests vs. bug reports: triage without a full-time PM",
    description:
      "Most teams collecting feedback don't have a dedicated product manager sorting it. Here's a triage system that holds up anyway.",
    date: "2026-06-05",
    tag: "Guide",
    readMinutes: 5,
    body: [
      {
        type: "p",
        text: "The moment you turn on a feedback widget, you have a new problem: a growing pile of bug reports, feature requests, and one-off complaints, and no one whose job it is to sort them. Most small teams don't have a PM running formal triage. That doesn't mean the pile has to turn into noise.",
      },
      { type: "h2", text: "Two buckets, not ten" },
      {
        type: "p",
        text: "The instinct when you first set up a board is to build out categories: UI, performance, onboarding, billing, mobile, and so on. Resist it early on. Two types cover almost everything that comes in: Bug (something is broken) and Feature (something doesn't exist yet). A third catch-all for everything else keeps the count at three. More categories than that just means more clicks per item and more decisions about which bucket something belongs in, decisions that don't actually change what you do next.",
      },
      { type: "h2", text: "Votes tell you what's popular, not what's next" },
      {
        type: "p",
        text: "A voting board is genuinely useful because it turns \"someone asked for this once\" into \"forty people asked for this.\" But treat the vote count as one input, not a queue you work top to bottom. A bug affecting 5% of your users' checkout flow can outrank a 200-vote feature request even at a fraction of the votes, because the cost of leaving it alone is different in kind, not just degree.",
      },
      {
        type: "list",
        items: [
          "Review the board on a fixed cadence (weekly is enough for most teams), not continuously — continuous triage is how it eats your day",
          "Anything reported independently by more than one or two users jumps the queue regardless of vote count, even a single-vote bug",
          "Close stale requests with a one-line reason instead of leaving them open forever — an honest \"not planned\" is more useful than a silent pile",
          "Let votes break ties between equally-important items, not decide importance on their own",
        ],
      },
      { type: "h2", text: "What changes as the pile grows" },
      {
        type: "p",
        text: "Eventually you'll want more structure: custom columns beyond Open, In Progress, and Done, or labels for the specific part of the product something touches. Add those when the two-bucket system is visibly costing you something, not before. The point of triage isn't to build a taxonomy, it's to spend your limited attention on the right five items this week.",
      },
      { type: "h2", text: "Try it with what you already have" },
      {
        type: "p",
        text: "If you're running Upstep, this is the default: Bug, Feature, and General, sorted by votes, with Open, In Progress, and Done to move things through. You don't need to configure anything to start triaging this way, just to resist the urge to over-configure it.",
      },
    ],
  },

  "two-line-integration-every-stack": {
    slug: "two-line-integration-every-stack",
    title: "The 2-line integration, in every stack we support",
    description:
      "\"Two lines of code\" is a specific, checkable claim. Here's what it actually looks like in React, plain JS, a script tag, and React Native.",
    date: "2026-06-18",
    tag: "Guide",
    readMinutes: 3,
    body: [
      {
        type: "p",
        text: "We say Upstep drops into an app in two lines of code. That's a claim you can check, so here it is for every stack we support, unedited.",
      },
      { type: "h2", text: "React" },
      {
        type: "code",
        lang: "tsx",
        code: `import { UpstepProvider, FeedbackWidget }\n  from "@upstep/js/react";\n\nexport default function App({ children }) {\n  return (\n    <UpstepProvider apiKey="upstep_xxx">\n      {children}\n      <FeedbackWidget />\n    </UpstepProvider>\n  );\n}`,
      },
      {
        type: "p",
        text: "The provider gives every component in the tree access to your project; the widget is the button and panel your users actually see. Next.js, Remix, Gatsby, and Vite all use the same two components.",
      },
      { type: "h2", text: "Plain JavaScript, no framework" },
      {
        type: "code",
        lang: "js",
        code: `import Upstep from "@upstep/js";\n\n// Mounts the feedback button automatically\nUpstep.init({ apiKey: "upstep_xxx" });`,
      },
      { type: "h2", text: "No build step at all" },
      {
        type: "code",
        lang: "html",
        code: `<script\n  type="module"\n  src="https://unpkg.com/@upstep/js/dist/index.js"\n  data-api-key="upstep_xxx"\n></script>`,
      },
      {
        type: "p",
        text: "This one's for WordPress, Webflow, Shopify, or any site where you can drop in a script tag but don't control a build pipeline. Same widget, same board on the other end.",
      },
      { type: "h2", text: "React Native" },
      {
        type: "code",
        lang: "tsx",
        code: `import { FeedbackProvider, FeedbackButton, FeedbackSheet }\n  from "@upstep/react-native";\n\nexport default function App() {\n  return (\n    <FeedbackProvider apiKey="upstep_xxx">\n      {/* your app */}\n      <FeedbackButton />\n      <FeedbackSheet />\n    </FeedbackProvider>\n  );\n}`,
      },
      {
        type: "p",
        text: "Same idea, native components. A button that opens a sheet instead of a panel, but it reports to the same project and the same board as your web app.",
      },
      { type: "h2", text: "One API key, one board" },
      {
        type: "p",
        text: "That's the part that matters more than the line count: web, mobile, and no-build-step sites all report to the same project with the same API key. Feedback from your iOS app and your marketing site's contact form lands on one board, sorted by votes, not three separate ones you have to check.",
      },
    ],
  },

  "why-your-ai-agent-needs-its-own-board": {
    slug: "why-your-ai-agent-needs-its-own-board",
    title: "Why your AI agent needs its own feedback board",
    description:
      "Since shipping the MCP server, the teams getting the most out of it aren't the ones handing their agent the public board. They're the ones giving it a separate one.",
    date: "2026-07-06",
    tag: "Product",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "When we shipped the MCP server, the obvious first move was pointing an agent at the same board your users see and letting it triage away. A few weeks in, that's not what the teams getting the most out of it are actually doing.",
      },
      { type: "h2", text: "One board, two very different kinds of work" },
      {
        type: "p",
        text: "A user-facing board carries requests you're accountable for: things people asked for, voted on, and are watching. An agent working through MCP generates a different kind of item entirely, a dependency bump it noticed was overdue, a flaky test it wants tracked, a refactor it's three steps into. None of that is dishonest to log, but none of it belongs next to a feature request with forty votes either. Mixing them doesn't make the agent's work more visible, it makes the user's board harder to trust.",
      },
      { type: "h2", text: "Give it a board of its own" },
      {
        type: "p",
        text: "The create_board tool exists for exactly this: an agent can spin up a workspace that's entirely its own, separate columns, separate everything, with create_feedback defaulting to Dev-only so anything it files stays off the public widget unless you say otherwise. Your users still see their bug reports and feature requests, sorted by votes, same as always. Your agent gets a backlog that's actually its own to work through.",
      },
      {
        type: "list",
        items: [
          "A refactor backlog the agent maintains and works down between other tasks",
          "Test flakiness or CI failures it noticed and wants to come back to",
          "Dependency or migration work it's tracking across multiple sessions",
          "Notes to itself mid-task that would otherwise just be scrollback",
        ],
      },
      { type: "h2", text: "Visibility, not autopilot" },
      {
        type: "p",
        text: "None of this means the agent's board runs unsupervised. The value is that you can open it and see what it's been doing, the same way you'd check in on a teammate, instead of either trusting it blindly or making it justify every action in chat. Separate boards make that check-in cheap: you look at the agent's board when you want to, and the public board stays exactly what your users think it is.",
      },
      { type: "h2", text: "Set it up" },
      {
        type: "p",
        text: "If you've already connected an agent through the MCP tab, ask it to create a board for its own work the next time it triages the inbox. If you haven't yet, the same command from the MCP server announcement gets you there in one line.",
      },
    ],
  },

  "fluid-boards-and-dev-only-tasks": {
    slug: "fluid-boards-and-dev-only-tasks",
    title: "Fluid triage boards, and a home for your agent's work",
    description:
      "Drag-and-drop that feels instant, plus separate boards so agent busywork never leaks into your public roadmap.",
    date: "2026-07-05",
    tag: "Product",
    readMinutes: 3,
    body: [
      {
        type: "p",
        text: "Two things landed together this week because they solve the same problem from opposite ends: keeping your triage board honest as more of the work on it comes from an AI agent instead of a person.",
      },
      { type: "h2", text: "Boards that glide" },
      {
        type: "p",
        text: "Cards lift and tilt while you drag them, columns light up when you're about to drop, and everything settles with a bit of spring instead of a hard stop. It's the same board, the same custom columns and labels, just without the friction.",
      },
      { type: "h2", text: "A separate board for your agent" },
      {
        type: "p",
        text: "Through the MCP server, your agent can now spin up its own board, its own columns, entirely apart from the board your users see. A refactor list, a backlog of internal cleanup, whatever it's tracking for itself stays off the public roadmap by construction, not by convention.",
      },
      { type: "h2", text: "Where to find it" },
      {
        type: "p",
        text: "Both are live now on every plan. Open a project's board to feel the first one, or the MCP tab to connect an agent and try the second.",
      },
    ],
  },
  "free-rice-calculator": {
    slug: "free-rice-calculator",
    title: "Stop eyeballing your backlog: a free RICE calculator",
    description:
      "Every prioritization conversation eventually needs a number, not a vibe. We got tired of rebuilding the same spreadsheet, so we built a free calculator instead.",
    date: "2026-07-07",
    tag: "Tools",
    readMinutes: 3,
    body: [
      {
        type: "p",
        text: "Every roadmap meeting eventually hits the same wall: two features, both reasonable, and no way to say which one wins without someone's gut feeling doing the deciding. RICE is the least annoying fix we've found for that, and we kept rebuilding the same spreadsheet to run it. So we built a free calculator instead.",
      },
      { type: "h2", text: "The four inputs" },
      {
        type: "list",
        items: [
          "Reach — how many people this affects in a given period, e.g. users per month",
          "Impact — how much it moves the needle per person, scored 3 (massive) down to 0.25 (minimal)",
          "Confidence — how sure you actually are about the first two numbers, as a percentage",
          "Effort — person-months to build it",
        ],
      },
      {
        type: "code",
        lang: "text",
        code: "score = (reach × impact × confidence) / effort",
      },
      { type: "h2", text: "Why a calculator instead of another spreadsheet" },
      {
        type: "p",
        text: "None of this is hard math. The part that gets tedious is redoing the same four-column table every quarter, re-deriving the formula from a blog post you half-remember, and losing track of which row you already scored. A calculator that just holds the table and sorts it for you removes the only annoying part of an otherwise simple framework.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "It's at /tools/rice-calculator, free, no signup. Everything runs in your browser — add a row per feature, fill in the four numbers, and it sorts by score as you type. Nothing is saved or sent anywhere, so it's also fine to use for something you'd rather not put in a shared doc yet.",
      },
      { type: "h2", text: "Where the numbers actually come from" },
      {
        type: "p",
        text: "The honest weak point of RICE is that Reach and Confidence are usually guesses dressed up as numbers. The fix isn't a better formula, it's a real signal to plug in. If you're running a public feedback board, your top-voted items already give you a Reach number that isn't a hallway guess, and a Confidence score that's backed by actual users instead of a hunch. That's most of what a tool like Upstep is for: turning \"I think people want this\" into a number you can put directly into the calculator.",
      },
    ],
  },

  "feedback-button-without-an-account": {
    slug: "feedback-button-without-an-account",
    title: "A feedback button for the project that isn't ready for a full board",
    description:
      "Not every landing page or client project needs a dashboard yet. We built a free, no-account widget generator for the version before that.",
    date: "2026-07-07",
    tag: "Tools",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "Not every site needs a feedback dashboard. A landing page you shipped last night, a client project in review, a side project with eleven users — sometimes you just want a small button that lets someone tell you something's broken, without setting up an account first. We built a free generator for exactly that gap.",
      },
      { type: "h2", text: "What it generates" },
      {
        type: "p",
        text: "You pick a button label, a position, an accent color, and an email address. It hands back a single self-contained script tag: no build step, no dependency, no backend of ours or yours in the loop.",
      },
      {
        type: "code",
        lang: "html",
        code: `<script>
(function () {
  var CONFIG = {
    buttonText: "Feedback",
    email: "you@example.com",
    accentColor: "#E05A33",
    side: "right",
  };
  // renders a floating button + modal, submits via mailto
})();
</script>`,
      },
      {
        type: "p",
        text: "Paste it before </body>, and a floating button shows up with a small modal behind it. Someone types their feedback, hits send, and it opens as a pre-filled email straight to you. No project to create, no API key, no server round-trip.",
      },
      { type: "h2", text: "The catch with mailto" },
      {
        type: "p",
        text: "We'd rather say this plainly than have you discover it later: mailto is a stopgap, not a system. There's no dedupe if five people report the same bug, no vote count to tell you what actually matters, no record once the email is buried in your inbox, and it depends on the visitor having a mail client configured at all. For a handful of messages a month, that's a fair trade for zero setup. Past that, it starts costing you more than it saves.",
      },
      { type: "h2", text: "When to graduate" },
      {
        type: "p",
        text: "The moment you notice yourself digging through email for \"that one bug report from a few weeks ago,\" that's the signal. Swapping the generated script for the real Upstep widget is the same two lines of code, except now submissions land in a dashboard instead of an inbox: votes, statuses, comments, and a public board your users can follow instead of a one-way email you might miss.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "It's at /tools/feedback-widget-generator, free, no account. Generate one, drop it on whatever you're building this week, and worry about a real board once mailto stops being enough.",
      },
    ],
  },
};

export function sortedPosts(): BlogPost[] {
  return Object.values(BLOG_POSTS).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
