export type GuideSection = { title: string; body: string; code?: string };
export type Guide = { slug: string; title: string; description: string; category: string; minutes: number; sections: GuideSection[] };

export const GUIDES: Record<string, Guide> = {
  "feedback-widget-nextjs": { slug: "feedback-widget-nextjs", title: "Add a feedback widget to Next.js", description: "Install a client-safe feedback widget in the App Router, identify signed-in users, and test submissions.", category: "Next.js", minutes: 6, sections: [
    { title: "Install the SDK", body: "Add the Upstep web package to your application.", code: "npm install @upstep/js" },
    { title: "Create a client component", body: "Browser APIs must run in a Client Component. Mount this component once from your root layout.", code: `"use client";\n\nimport { useEffect } from "react";\nimport Upstep from "@upstep/js";\n\nexport function FeedbackWidget() {\n  useEffect(() => {\n    Upstep.init({ apiKey: process.env.NEXT_PUBLIC_UPSTEP_KEY! });\n  }, []);\n  return null;\n}` },
    { title: "Identify the user", body: "Pass a stable application user ID when available. This prevents duplicate votes without exposing private customer data.", code: `Upstep.identify(session.user.id);` },
    { title: "Test the integration", body: "Open the application, submit a test item, and confirm it appears in your Upstep inbox. Keep the public API key in a NEXT_PUBLIC variable; never expose server secrets." },
  ]},
  "feedback-widget-flutter": { slug: "feedback-widget-flutter", title: "Collect product feedback in Flutter", description: "Mount Upstep near your app root and open a native feedback sheet from your own interface.", category: "Flutter", minutes: 7, sections: [
    { title: "Install the package", body: "Add the maintained Flutter SDK to your project.", code: "flutter pub add upstep_flutter" },
    { title: "Configure the provider", body: "Mount Upstep above the screens that can open feedback.", code: `Upstep(\n  apiKey: const String.fromEnvironment('UPSTEP_API_KEY'),\n  userId: currentUser?.id,\n  child: const MyApp(),\n)` },
    { title: "Open the feedback sheet", body: "Use your existing settings, help, or navigation UI as the trigger.", code: `FeedbackButton(\n  label: 'Send feedback',\n)` },
    { title: "Production checklist", body: "Use a stable user ID, verify the API base URL for self-hosted deployments, submit on both Android and iOS, and confirm keyboard insets do not cover the form." },
  ]},
  "product-feedback-mcp": { slug: "product-feedback-mcp", title: "Connect product feedback to an AI coding agent with MCP", description: "Give Claude Code, Codex, Cursor, or another MCP client scoped access to triage an Upstep project.", category: "MCP", minutes: 8, sections: [
    { title: "Create a project key", body: "Open the project settings in Upstep and copy its API key. The key scopes the connection to one project, so use a different key for each product." },
    { title: "Configure the MCP endpoint", body: "Add the hosted endpoint and authenticate with the project key using the configuration format supported by your client.", code: `{\n  "mcpServers": {\n    "upstep": {\n      "url": "https://upstep.dev/api/mcp",\n      "headers": { "Authorization": "Bearer YOUR_PROJECT_KEY" }\n    }\n  }\n}` },
    { title: "Start with read-only triage", body: "Ask the agent to summarize open feedback, group duplicates, and identify highly voted items. Review the result before allowing mutations." },
    { title: "Turn feedback into work", body: "Once the connection is trusted, the agent can create internal tasks, update status, add comments, and keep implementation work separate from the public board." },
  ]},
};
