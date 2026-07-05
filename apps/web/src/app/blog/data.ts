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
};

export function sortedPosts(): BlogPost[] {
  return Object.values(BLOG_POSTS).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
