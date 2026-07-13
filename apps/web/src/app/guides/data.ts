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
  "feedback-widget-react-native": {
    slug: "feedback-widget-react-native",
    title: "Add feedback and feature voting to a React Native app",
    description: "Build a native feedback flow in React Native with a provider, bottom sheet, user identity, custom triggers, and production-ready testing.",
    category: "React Native",
    minutes: 12,
    intro: "This integration keeps feedback in the app your customer is already using. The default launcher opens a bottom sheet with a request form and voting board, backed by the same Upstep project as web and mobile clients.",
    prerequisites: ["A React Native or Expo application", "A project API key from Upstep", "react-native-safe-area-context installed in the app"],
    sections: [
      { title: "Install the SDK and safe-area dependency", body: "The sheet needs safe-area information to avoid notches, home indicators, and navigation bars. Install both packages before wiring the provider.", code: "npm install @upstep/react-native react-native-safe-area-context", checklist: ["Rebuild the native app after adding a native dependency.", "Use the same package manager your app already uses."] },
      { title: "Wrap the application once", body: "FeedbackProvider owns the API client and sheet state. Place it high enough that any signed-in screen can open feedback, but do not mount multiple providers for the same project.", code: `import { FeedbackProvider, FeedbackButton, FeedbackSheet } from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider apiKey={process.env.EXPO_PUBLIC_UPSTEP_KEY!}>
      <AppNavigator />
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}` },
      { title: "Use a build-time environment variable", body: "Expose only the Upstep project key to the client. Keep your database, payment, and authentication secrets server-side. For Expo, use an EXPO_PUBLIC variable; for bare React Native, inject configuration with your existing build configuration.", code: `# .env
EXPO_PUBLIC_UPSTEP_KEY=upstep_your_project_key`, details: ["Create a separate Upstep project for staging.", "Confirm the production key is set in the CI release environment."] },
      { title: "Identify a customer after authentication", body: "A stable internal ID lets the SDK associate feedback and deduplicate votes. The provider can receive userId initially, or you can identify a user later through the hook once your session has loaded.", code: `import { useEffect } from "react";
import { useUpstep } from "@upstep/react-native";

function SyncFeedbackIdentity({ userId }: { userId?: string }) {
  const { identify } = useUpstep();
  useEffect(() => identify(userId), [identify, userId]);
  return null;
}` },
      { title: "Open feedback from your own interface", body: "The floating launcher is optional. Use the same sheet from a Settings row, help center, or error screen so feedback appears at the moment a customer has context to share.", code: `import { useUpstep } from "@upstep/react-native";

function HelpRow() {
  const { openSheet } = useUpstep();
  return <Pressable onPress={openSheet}><Text>Send feedback</Text></Pressable>;
}` },
      { title: "Tune the default launcher", body: "If you retain the default button, it can be positioned and labeled to match the app. Keep it clear of your tab bar and avoid using a label that competes with support or account actions.", code: `<FeedbackButton
  position="bottom-right"
  label="Share feedback"
/>` },
      { title: "Test on physical devices", body: "Use a real Android device and iPhone before release. Check keyboard behaviour, safe areas, anonymous submission, identified voting, and a slow network connection.", checklist: ["The sheet does not sit behind a tab bar or home indicator.", "Feedback creates an item in the intended project.", "A vote updates and stays after reopening the sheet.", "The app remains usable if the feedback API is temporarily unavailable."] },
    ],
    troubleshooting: [
      { issue: "The provider cannot find safe-area context.", answer: "Ensure react-native-safe-area-context is installed and your app has its usual SafeAreaProvider where required." },
      { issue: "The button opens but no feedback is shown.", answer: "Confirm FeedbackSheet is mounted inside the same FeedbackProvider as the button." },
      { issue: "The production build uses the wrong project.", answer: "Check the release environment variable and use a dedicated staging project rather than sharing a production key during QA." },
    ],
  },
  "how-to-build-a-public-roadmap": {
    slug: "how-to-build-a-public-roadmap",
    title: "Build a public roadmap customers can trust",
    description: "Set up a customer-friendly public roadmap without false promises: decide what to publish, use clear statuses, collect votes, and maintain it over time.",
    category: "Product management",
    minutes: 10,
    intro: "A good public roadmap explains direction and progress. It is not a delivery contract or a dump of every internal task. This guide uses Upstep’s feedback board and roadmap workflow to create a useful, maintainable customer view.",
    prerequisites: ["An Upstep project with at least two workflow statuses", "A clear owner for roadmap decisions", "A shortlist of customer-visible initiatives"],
    sections: [
      { title: "Choose the promise your roadmap makes", body: "Decide whether the roadmap communicates broad direction, confirmed work, or release timing. Most early products should communicate direction with broad horizons rather than calendar dates. Customers need to understand what is being considered and what is actively underway—not a promise you cannot keep.", details: ["Now: active, committed work.", "Next: validated work that may change order.", "Later: promising problems that need more evidence."] },
      { title: "Keep internal tasks separate", body: "Do not publish every engineering task, security fix, dependency upgrade, or half-formed idea. Create internal tasks for implementation work and publish only customer-meaningful outcomes. Upstep internal items stay on the team board and out of the public feedback experience.", checklist: ["Every public item describes a customer outcome.", "Internal subtasks are marked Dev-only.", "Sensitive fixes are never exposed before the relevant release." ] },
      { title: "Define statuses customers understand", body: "Use short, plain-language status names. Your public status should answer a customer’s question: is this idea being considered, actively built, or complete? Avoid internal acronyms and engineering-specific workflow names.", code: `Suggested public statuses

Under consideration
Planned
In progress
Shipped` },
      { title: "Collect votes as evidence, not a referendum", body: "Votes reveal concentration of demand, but they do not replace product strategy. Combine vote count with customer segment, revenue impact, support frequency, effort, and confidence. The highest-voted request may not be the next thing to ship.", details: ["Use votes to find duplicate demand.", "Ask follow-up questions before committing to broad requests.", "Score comparable initiatives with the free RICE calculator."] },
      { title: "Explain movement on the roadmap", body: "When an item changes status, add a concise team comment when useful. Customers tolerate a changed order much better when they can see the reasoning: a dependency, a stronger customer need, or newly discovered scope.", code: `Example update

We moved this into Planned after hearing the same request from teams managing multiple workspaces. We are validating the first version now and will share timing once the scope is confirmed.` },
      { title: "Share the right entry point", body: "Link to the public roadmap from your Help, changelog, in-product feedback launcher, or customer email. Do not force customers to hunt for it. The same feedback flow should let them submit an idea, vote for an existing request, and follow progress.", checklist: ["The roadmap link is reachable from the product.", "New feedback lands in a reviewable inbox or first board column.", "Customers can vote for existing requests instead of submitting duplicates."] },
      { title: "Run a lightweight maintenance ritual", body: "Review public items on a regular cadence. Archive stale requests, consolidate duplicates, promote validated work, and mark shipped outcomes promptly. A small honest roadmap maintained monthly is more credible than a detailed one that has not changed in a year." },
    ],
    troubleshooting: [
      { issue: "Customers think a planned item has a guaranteed date.", answer: "Use horizon language, avoid dates until confidence is high, and explain the meaning of each status near the roadmap." },
      { issue: "The roadmap is overwhelmed by duplicate requests.", answer: "Merge or link duplicates during triage and direct customers to vote for the canonical item." },
      { issue: "The team stops updating it.", answer: "Assign a single owner and make roadmap review part of the existing weekly or monthly product review." },
    ],
  },
  "product-feedback-triage": {
    slug: "product-feedback-triage",
    title: "Create a product-feedback triage workflow that scales",
    description: "Turn raw requests, bug reports, and votes into a consistent weekly product-feedback workflow without losing customer context.",
    category: "Product management",
    minutes: 11,
    intro: "Feedback becomes valuable only after it is consistently reviewed. This workflow gives small teams a simple system for classifying requests, deduplicating demand, making decisions, and closing the loop with customers.",
    prerequisites: ["An Upstep project receiving customer feedback", "One owner for the weekly review", "Basic statuses and labels in the feedback board"],
    sections: [
      { title: "Start with a small workflow", body: "Use only the states your team can keep current. A simple workflow reduces ambiguity and makes your board readable during a quick weekly review.", code: `Suggested internal workflow

New → Reviewing → Planned → In progress → Done

Optional: Needs more context` },
      { title: "Classify the incoming item", body: "During triage, first decide whether the item is a bug, feature request, or general feedback. Then add labels for the affected area, customer segment, platform, or urgency. Classification makes later analysis possible without turning every submission into a lengthy form.", details: ["Use a small stable label set such as Billing, Mobile, Onboarding, and Integrations.", "Reserve urgent for genuine time-sensitive customer impact.", "Keep customer wording in the original item rather than rewriting away useful context."] },
      { title: "Find duplicate demand", body: "Search before creating a new canonical request. When several people ask for the same outcome, consolidate their demand around one item, retain the useful details, and use the vote total as a clear signal. Do not delete a report that contains distinct reproduction steps or customer context." },
      { title: "Ask for the missing decision context", body: "A request such as make exports better is not enough to plan. Ask what the customer is trying to accomplish, what happens today, who is affected, and how often. Add the answer as a comment or internal note before moving the item to Planned.", code: `Useful follow-up questions

• What outcome are you trying to achieve?
• What is the current workaround?
• How often does this block you?
• Which part of the product are you using when it happens?` },
      { title: "Prioritize with a repeatable decision", body: "Use votes as one input, then compare reach, impact, confidence, effort, strategic fit, and urgency. For comparable feature requests, put the assumptions into a RICE score so the team can discuss the inputs rather than argue about a mysterious ranking.", details: ["Use the RICE calculator for a quick shared score.", "Treat bugs with severe customer impact separately from feature scoring.", "Document why an item was deferred when that context will matter later."] },
      { title: "Create implementation work without leaking it", body: "When a request is selected, create an internal development task and link its purpose to the customer-facing request. Keep the public item readable; implementation subtasks, estimates, and investigation notes belong on the internal board.", checklist: ["The customer-facing request has the right status.", "Implementation work is internal.", "The owner and next review date are clear."] },
      { title: "Close the loop after shipping", body: "Mark the request Done, add a brief release note or comment, and thank the people who raised it when appropriate. This makes voting feel worthwhile and trains customers to keep sharing higher-quality feedback." },
    ],
    troubleshooting: [
      { issue: "Everything becomes high priority.", answer: "Define an explicit urgent threshold such as a security issue, data loss, or a widespread blocked workflow. Keep all other work in the normal comparison process." },
      { issue: "The board has hundreds of untouched requests.", answer: "Create a weekly triage block, archive truly stale items, and consolidate duplicates before adding new process states." },
      { issue: "Customers stop submitting useful detail.", answer: "Show that good feedback leads to follow-up, decisions, and shipped updates. A visible response loop improves future submissions." },
    ],
  },
};
