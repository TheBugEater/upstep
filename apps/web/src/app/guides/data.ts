export type GuideSection = {
  title: string;
  body: string;
  code?: string;
  details?: string[];
  checklist?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  minutes: number;
  intro: string;
  prerequisites: string[];
  sections: GuideSection[];
  troubleshooting: { issue: string; answer: string }[];
};

export const GUIDES: Record<string, Guide> = {
  "feedback-widget-nextjs": {
    slug: "feedback-widget-nextjs",
    title: "Add a feedback widget to a Next.js app",
    description: "A complete App Router guide for collecting feedback in-product, identifying users, customizing the widget, and verifying submissions.",
    category: "Next.js",
    minutes: 12,
    intro: "This guide adds Upstep to a Next.js App Router application without turning your layout into a Client Component. The widget mounts once in the browser, while the rest of the app can remain server-rendered.",
    prerequisites: ["A Next.js 13+ application using the App Router", "An Upstep project and its project API key", "Node.js 18 or later"],
    sections: [
      {
        title: "Create a project and choose the right key",
        body: "Create an app in the Upstep dashboard, then copy its project API key from Settings. This key is intentionally used in the browser: it only identifies the feedback project. Do not put database, Stripe, auth, or other server-only credentials in the same environment variable.",
        details: ["Use one Upstep project per customer-facing product or environment.", "For staging, create a separate Upstep project so test feedback never appears in production.", "Add the value to .env.local and do not commit it."],
        code: "NEXT_PUBLIC_UPSTEP_KEY=upstep_your_project_key",
      },
      {
        title: "Install the browser SDK",
        body: "The JavaScript SDK supplies the launcher, feedback form, voting board, and API client. It does not require a server-side route in your Next.js app.",
        code: "npm install @upstep/js",
      },
      {
        title: "Mount the widget in one Client Component",
        body: "The SDK reads browser APIs, so initialize it in a file marked use client. Keep this component tiny and render it once from the root layout. The rest of your layout, including data fetching and authentication, can stay as Server Components.",
        code: `// app/components/feedback-widget.tsx
"use client";

import { useEffect } from "react";
import Upstep from "@upstep/js";

export function FeedbackWidget() {
  useEffect(() => {
    Upstep.init({
      apiKey: process.env.NEXT_PUBLIC_UPSTEP_KEY!,
      theme: "auto",
      position: "right",
    });
  }, []);

  return null;
}`,
      },
      {
        title: "Render it from the root layout",
        body: "Place the component immediately inside body so it survives client-side navigation. Upstep only needs mounting once; adding it to individual pages creates duplicate launchers after navigation.",
        code: `// app/layout.tsx
import { FeedbackWidget } from "./components/feedback-widget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}`,
      },
      {
        title: "Identify signed-in users after login",
        body: "Identification is optional, but recommended. A stable internal user ID helps Upstep deduplicate votes and lets you connect useful feedback to a known account. Do not send an email address unless it is also the user ID you intentionally use in your product.",
        code: `"use client";

import { useEffect } from "react";
import Upstep from "@upstep/js";

export function IdentifyUpstepUser({ userId }: { userId?: string }) {
  useEffect(() => {
    Upstep.identify(userId);
  }, [userId]);

  return null;
}`,
        details: ["Render this only after your client-side session has resolved.", "Call Upstep.identify(undefined) when a user signs out.", "Use an opaque database ID rather than a mutable display name."],
      },
      {
        title: "Use your own feedback button instead of the floating launcher",
        body: "If your product already has a Help menu, command palette, or settings page, hide the default launcher and open the same widget from your own button. This makes feedback feel native to the product while preserving the full Upstep form and voting board.",
        code: `// feedback-widget.tsx
Upstep.init({
  apiKey: process.env.NEXT_PUBLIC_UPSTEP_KEY!,
  launcher: false,
});

// Any Client Component
import Upstep from "@upstep/js";

<button onClick={() => Upstep.open()}>Send feedback</button>`,
      },
      {
        title: "Test the complete feedback path",
        body: "Run the application locally, open the widget, submit a feature request, vote for it, and confirm that the item appears in the matching Upstep project. Then test in an incognito browser to verify the anonymous flow separately from the identified-user flow.",
        checklist: ["The launcher appears exactly once after navigation.", "A submitted item arrives in the correct project.", "The user can vote once without a confusing error.", "The widget follows light and dark mode as expected.", "Staging traffic does not enter the production board."],
      },
    ],
    troubleshooting: [
      { issue: "The widget appears twice in development.", answer: "Make sure the initialization component is rendered once in the root layout. Do not mount it in both a page and a layout." },
      { issue: "Nothing appears after deployment.", answer: "Confirm NEXT_PUBLIC_UPSTEP_KEY exists in the deployment environment, then redeploy. Variables prefixed with NEXT_PUBLIC_ are compiled into the client bundle." },
      { issue: "Votes are not tied to accounts.", answer: "Call Upstep.identify with the same stable application user ID after your session resolves." },
    ],
  },
  "feedback-widget-flutter": {
    slug: "feedback-widget-flutter",
    title: "Collect in-app product feedback with Flutter",
    description: "A complete Flutter integration: provider setup, floating and custom launchers, user identification, theming, and release checks.",
    category: "Flutter",
    minutes: 12,
    intro: "Upstep’s Flutter SDK gives your app a floating launcher and native bottom sheet containing feedback submission and voting. All feedback lands in the same project board used by your web product.",
    prerequisites: ["A Flutter application with Material widgets", "Flutter 3.0 or later", "An Upstep project API key"],
    sections: [
      { title: "Create a separate feedback project", body: "Create an Upstep project for the mobile app and copy its API key. If web and mobile should share one backlog, use the same key in both clients. Otherwise give each product its own project so triage stays focused.", details: ["Use a second project for staging or internal QA.", "The project key is used by the client SDK; do not substitute server secrets."] },
      { title: "Install the Flutter package", body: "Add the maintained package from pub.dev, then fetch dependencies as normal.", code: "flutter pub add upstep_flutter\nflutter pub get" },
      {
        title: "Wrap the app and mount the sheet once",
        body: "Upstep should wrap the part of the widget tree that needs to open feedback. The sheet and button belong inside a Stack so they render above your regular page content. Mount one FeedbackSheet for the whole app.",
        code: `import 'package:flutter/material.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Upstep(
        apiKey: const String.fromEnvironment('UPSTEP_API_KEY'),
        child: Scaffold(
          appBar: AppBar(title: const Text('My app')),
          body: Stack(
            children: const [
              Center(child: Text('Your app content')),
              FeedbackSheet(),
              FeedbackButton(),
            ],
          ),
        ),
      ),
    );
  }
}`,
      },
      {
        title: "Pass the project key at build time",
        body: "Keep the key out of source control. For local development and CI, pass it with dart-define. This makes staging and production values explicit in your build workflow.",
        code: `flutter run --dart-define=UPSTEP_API_KEY=upstep_your_project_key

# Example release build
flutter build appbundle --dart-define=UPSTEP_API_KEY=upstep_your_project_key`,
      },
      {
        title: "Identify a user after authentication",
        body: "When the app already knows who is signed in, update the SDK controller with a stable account ID. This improves duplicate-vote protection across devices while still allowing anonymous feedback before sign-in.",
        code: `// Call after authentication succeeds.
Upstep.of(context, listen: false).identify(currentUser.id);

// Optional: clear the identity after logout.
Upstep.of(context, listen: false).identify(null);`,
      },
      {
        title: "Match the launcher to your app",
        body: "The default button works well for most apps. You can choose its corner, label, icon, accent color, and theme mode. For a custom menu item, call openSheet from any widget inside Upstep instead of rendering FeedbackButton.",
        code: `Upstep(
  apiKey: apiKey,
  accentColor: const Color(0xFFE05A33),
  themeMode: UpstepThemeMode.auto,
  child: Stack(
    children: [
      const HomeScreen(),
      const FeedbackSheet(),
      FeedbackButton(
        position: FeedbackButtonPosition.bottomRight,
        label: 'Send feedback',
      ),
    ],
  ),
)

// From a custom button:
onPressed: () => Upstep.of(context, listen: false).openSheet(),`,
      },
      { title: "Release checklist", body: "Test both the visible launcher and the full submission flow on physical devices. A simulator can miss safe-area and keyboard behaviour that affects a bottom sheet.", checklist: ["Test Android and iOS with the keyboard open.", "Check that the launcher clears navigation bars and home indicators.", "Submit feedback while logged out and while logged in.", "Verify the selected Upstep project receives the item.", "Check light and dark themes on a real device."] },
    ],
    troubleshooting: [
      { issue: "Upstep.of throws an ancestor error.", answer: "The calling widget is outside the Upstep widget. Move the button below the Upstep provider in the tree." },
      { issue: "The sheet never opens.", answer: "Mount FeedbackSheet once inside the same Upstep subtree as the launcher or custom trigger." },
      { issue: "The API key is empty in a release build.", answer: "Pass UPSTEP_API_KEY using --dart-define in the release command, not only when running locally." },
    ],
  },
  "product-feedback-mcp": {
    slug: "product-feedback-mcp",
    title: "Connect product feedback to an AI coding agent with MCP",
    description: "Connect Claude Code, Codex, Cursor, or another MCP client to one Upstep project, then use safe prompts to turn feedback into product work.",
    category: "MCP",
    minutes: 14,
    intro: "Upstep exposes a hosted Streamable HTTP MCP server. A project API key scopes every request to exactly one feedback board, allowing an agent to read, organize, and update the backlog without access to your wider account.",
    prerequisites: ["An Upstep project with an API key", "A compatible MCP client such as Claude Code, Codex, or Cursor", "A clear distinction between customer-visible feedback and internal development tasks"],
    sections: [
      { title: "Understand the access boundary", body: "The API key does not grant access to every Upstep project. It scopes the agent to one project’s feedback, statuses, labels, boards, and comments. Create separate keys by creating separate projects when client, team, or environment boundaries matter.", details: ["Do not commit a project key to Git.", "Store the key in your shell environment or MCP client secret store.", "Rotate a key in Upstep Settings if it is exposed."] },
      {
        title: "Configure Claude Code",
        body: "Claude Code can add the hosted MCP server through its command line. Substitute the API key only in your shell environment; the command references the value rather than writing it into a repository file.",
        code: `claude mcp add --transport http upstep https://upstep.dev/api/mcp \\
  --header "Authorization: Bearer YOUR_PROJECT_KEY"`,
      },
      {
        title: "Configure Codex",
        body: "For Codex, keep the project key in an environment variable and let the MCP configuration reference it. This is safer than storing a bearer token in a checked-in configuration file.",
        code: `export UPSTEP_API_KEY="upstep_your_project_key"
codex mcp add upstep --url https://upstep.dev/api/mcp \\
  --bearer-token-env-var UPSTEP_API_KEY`,
      },
      {
        title: "Configure another Streamable HTTP MCP client",
        body: "Most clients accept an MCP server URL plus a Bearer authorization header. Check your client’s current MCP configuration format, then point it at the hosted endpoint.",
        code: `{
  "mcpServers": {
    "upstep": {
      "url": "https://upstep.dev/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PROJECT_KEY"
      }
    }
  }
}`,
      },
      {
        title: "Verify the connection with read-only triage",
        body: "Start with a request that does not change feedback. The overview contains counts, board columns, and leading open items; listing feedback lets you filter by status, type, votes, or search text.",
        code: `Use Upstep to:
1. Get a project overview.
2. List the 20 highest-voted open requests.
3. Group likely duplicates, but do not change anything.
4. Return a short triage report with links or IDs for every recommendation.`,
      },
      {
        title: "Use a safe mutation workflow",
        body: "Once the read-only output is useful, let the agent make bounded changes. Ask it to create internal tasks by default so agent-generated work stays hidden from users until a human explicitly publishes it. Require a review summary after every mutation.",
        code: `Review the top three requests. For each one:
- create an internal task only if no equivalent internal task exists;
- label it "triage";
- do not change customer-visible request titles or status;
- finish with a table of every created task and why it was created.`,
        details: ["create_feedback defaults to internal: true.", "update_feedback can move work by board-column name.", "add_comment posts a customer-visible team comment, so reserve it for reviewed responses."],
      },
      {
        title: "Build a weekly feedback ritual",
        body: "MCP is most useful as a repeatable review step, not a replacement for product judgment. Use the agent to reduce reading and grouping work, then let a product owner decide what becomes public roadmap work.",
        checklist: ["Weekly: summarize new open feedback and report vote movement.", "Weekly: surface duplicate clusters for human review.", "Monthly: compare completed work with the most requested themes.", "Before shipping: draft, then review, any customer-facing comments."] },
    ],
    troubleshooting: [
      { issue: "The client reports an authentication error.", answer: "Confirm the project API key is current and that the Authorization header is exactly Bearer followed by the key. Then restart or reload the MCP client." },
      { issue: "The agent cannot see expected feedback.", answer: "Check that the key belongs to the intended project and that the feedback is not in a different project or hidden pending-review state." },
      { issue: "The agent made a customer-visible change too early.", answer: "Use prompt constraints: start read-only, create internal tasks by default, and require a human review before comments or public-status changes." },
    ],
  },
};
