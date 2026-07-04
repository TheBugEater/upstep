export type Integration = {
  slug: string;
  name: string;
  category: "Framework" | "Build tool" | "Mobile" | "No-code / CMS";
  headline: string;
  intro: string;
  steps: string[];
  codeLang: string;
  code: string;
  notes?: string[];
};

export const INTEGRATIONS: Record<string, Integration> = {
  react: {
    slug: "react",
    name: "React",
    category: "Framework",
    headline: "Feedback widget for React apps",
    intro:
      "Upstep ships a typed React SDK: a provider plus a drop-in widget component. No REST calls to wire up, no state to manage yourself.",
    steps: [
      "Install the package: npm install @upstep/js",
      "Wrap your app in <UpstepProvider apiKey=\"...\">",
      "Drop <FeedbackWidget /> anywhere inside, it renders its own launcher button and modal.",
    ],
    codeLang: "tsx",
    code: `import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export default function App({ children }) {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      {children}
      <FeedbackWidget />
    </UpstepProvider>
  );
}`,
  },

  nextjs: {
    slug: "nextjs",
    name: "Next.js",
    category: "Framework",
    headline: "Feedback widget for Next.js (App Router)",
    intro:
      "The widget needs to run on the client, so wrap it in its own \"use client\" component and mount that once from your root layout, the same pattern Upstep uses to dogfood itself on this site.",
    steps: [
      "Install: npm install @upstep/js",
      "Create a small \"use client\" wrapper component that renders UpstepProvider + FeedbackWidget",
      "Import that component into app/layout.tsx so it mounts on every route",
    ],
    codeLang: "tsx",
    code: `"use client";
import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export function Feedback() {
  return (
    <UpstepProvider apiKey={process.env.NEXT_PUBLIC_UPSTEP_API_KEY!}>
      <FeedbackWidget />
    </UpstepProvider>
  );
}

// app/layout.tsx
// import { Feedback } from "@/components/Feedback";
// <body>{children}<Feedback /></body>`,
    notes: ["Use NEXT_PUBLIC_ prefixed env vars, the key ships to the browser bundle by design, the same way it does in a script tag."],
  },

  remix: {
    slug: "remix",
    name: "Remix",
    category: "Framework",
    headline: "Feedback widget for Remix apps",
    intro:
      "UpstepProvider only touches the DOM inside useEffect, so it's safe to render from Remix's root route without any client-only guard.",
    steps: [
      "Install: npm install @upstep/js",
      "Import UpstepProvider + FeedbackWidget into app/root.tsx",
      "Wrap the <Outlet /> so the widget is available on every route",
    ],
    codeLang: "tsx",
    code: `import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";
import { Outlet } from "@remix-run/react";

export default function App() {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      <Outlet />
      <FeedbackWidget />
    </UpstepProvider>
  );
}`,
  },

  gatsby: {
    slug: "gatsby",
    name: "Gatsby",
    category: "Framework",
    headline: "Feedback widget for Gatsby sites",
    intro:
      "Use Gatsby's wrapRootElement API in gatsby-browser.js, the standard place to inject a provider that should persist across page navigations.",
    steps: [
      "Install: npm install @upstep/js",
      "Create gatsby-browser.js (and gatsby-ssr.js for parity) in your project root",
      "Export wrapRootElement to render UpstepProvider + FeedbackWidget around your app",
    ],
    codeLang: "jsx",
    code: `// gatsby-browser.js
import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export const wrapRootElement = ({ element }) => (
  <UpstepProvider apiKey="upstep_xxx">
    {element}
    <FeedbackWidget />
  </UpstepProvider>
);`,
  },

  vite: {
    slug: "vite",
    name: "Vite",
    category: "Build tool",
    headline: "Feedback widget for Vite apps",
    intro:
      "For a plain Vite + TypeScript/JS app (no React), use the framework-agnostic widget class, one import, one init call in your entry file.",
    steps: [
      "Install: npm install @upstep/js",
      "Import and call Upstep.init() in your main entry file (e.g. main.ts)",
      "The launcher button mounts itself once the DOM is ready",
    ],
    codeLang: "ts",
    code: `import Upstep from "@upstep/js";

Upstep.init({ apiKey: "upstep_xxx" });`,
  },

  vue: {
    slug: "vue",
    name: "Vue.js",
    category: "Framework",
    headline: "Feedback widget for Vue apps",
    intro:
      "There's no Vue-specific package, but the vanilla widget is framework-agnostic, call it once when your root component mounts.",
    steps: [
      "Install: npm install @upstep/js",
      "In App.vue, call Upstep.init() inside onMounted so it only runs in the browser",
    ],
    codeLang: "vue",
    code: `<script setup>
import { onMounted } from "vue";
import Upstep from "@upstep/js";

onMounted(() => {
  Upstep.init({ apiKey: "upstep_xxx" });
});
</script>`,
  },

  nuxt: {
    slug: "nuxt",
    name: "Nuxt",
    category: "Framework",
    headline: "Feedback widget for Nuxt apps",
    intro:
      "Nuxt renders on the server first, so mount the widget from a client-only plugin using Nuxt's .client.ts naming convention.",
    steps: [
      "Install: npm install @upstep/js",
      "Create plugins/upstep.client.ts, the .client suffix tells Nuxt to only run it in the browser",
      "Call Upstep.init() inside the plugin",
    ],
    codeLang: "ts",
    code: `// plugins/upstep.client.ts
import Upstep from "@upstep/js";

export default defineNuxtPlugin(() => {
  Upstep.init({ apiKey: "upstep_xxx" });
});`,
  },

  svelte: {
    slug: "svelte",
    name: "Svelte & SvelteKit",
    category: "Framework",
    headline: "Feedback widget for Svelte apps",
    intro:
      "Call Upstep.init() from onMount in your root layout, onMount only runs client-side, so it's safe with SvelteKit's SSR.",
    steps: [
      "Install: npm install @upstep/js",
      "In src/routes/+layout.svelte, call Upstep.init() inside onMount",
    ],
    codeLang: "svelte",
    code: `<script>
  import { onMount } from "svelte";
  import Upstep from "@upstep/js";

  onMount(() => {
    Upstep.init({ apiKey: "upstep_xxx" });
  });
</script>

<slot />`,
  },

  astro: {
    slug: "astro",
    name: "Astro",
    category: "Framework",
    headline: "Feedback widget for Astro sites",
    intro:
      "Astro ships zero JS by default, so the simplest path is the plain script tag, drop it in your base layout and it loads once, on every page.",
    steps: [
      "Open your shared layout (e.g. src/layouts/Layout.astro)",
      "Add the script tag before </body> with your API key as a data attribute",
    ],
    codeLang: "astro",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },

  angular: {
    slug: "angular",
    name: "Angular",
    category: "Framework",
    headline: "Feedback widget for Angular apps",
    intro:
      "Call Upstep.init() once from your root component's ngOnInit, it mounts the launcher button and stays mounted across route changes.",
    steps: [
      "Install: npm install @upstep/js",
      "In app.component.ts, call Upstep.init() inside ngOnInit",
    ],
    codeLang: "ts",
    code: `import { Component, OnInit } from "@angular/core";
import Upstep from "@upstep/js";

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent implements OnInit {
  ngOnInit() {
    Upstep.init({ apiKey: "upstep_xxx" });
  }
}`,
  },

  wordpress: {
    slug: "wordpress",
    name: "WordPress",
    category: "No-code / CMS",
    headline: "Feedback widget for WordPress sites",
    intro:
      "No plugin required, paste the script tag into your theme's footer using a header/footer plugin, or your theme editor directly.",
    steps: [
      "Install a footer-code plugin (e.g. \"Insert Headers and Footers\" / WPCode), or edit your theme's footer.php if you're comfortable with that",
      "Paste the script tag into the site-wide footer field",
      "Save, the launcher button appears on every page of your site",
    ],
    codeLang: "html",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },

  webflow: {
    slug: "webflow",
    name: "Webflow",
    category: "No-code / CMS",
    headline: "Feedback widget for Webflow sites",
    intro:
      "Webflow has a built-in custom code slot for exactly this, no export or dev handoff needed.",
    steps: [
      "Open Project Settings → Custom Code",
      "Paste the script tag into the Footer Code box (applies site-wide)",
      "Publish your site",
    ],
    codeLang: "html",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },

  shopify: {
    slug: "shopify",
    name: "Shopify",
    category: "No-code / CMS",
    headline: "Feedback widget for Shopify stores",
    intro:
      "Add the script tag to your theme's layout file once, and every page of your storefront gets a feedback launcher.",
    steps: [
      "Go to Online Store → Themes → Edit Code",
      "Open layout/theme.liquid",
      "Paste the script tag just before the closing </body> tag",
    ],
    codeLang: "liquid",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },

  html: {
    slug: "html",
    name: "Plain HTML / JS",
    category: "Build tool",
    headline: "Feedback widget for any HTML site",
    intro:
      "No build step, no framework, one script tag before your closing </body> is the entire integration.",
    steps: [
      "Paste the script tag into your HTML, right before </body>",
      "That's it, no npm install, no bundler required",
    ],
    codeLang: "html",
    code: `<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
></script>`,
  },

  "react-native": {
    slug: "react-native",
    name: "React Native",
    category: "Mobile",
    headline: "Feedback SDK for React Native apps",
    intro:
      "A dedicated React Native package with a provider, a launcher button, a bottom sheet, and an optional shake-to-report gesture, no web view involved.",
    steps: [
      "Install: npm install @upstep/react-native react-native-safe-area-context",
      "Wrap your app in <FeedbackProvider apiKey=\"...\">",
      "Render <FeedbackButton /> and <FeedbackSheet />, or trigger the sheet with the useShakeToFeedback hook",
    ],
    codeLang: "tsx",
    code: `import { FeedbackProvider, FeedbackButton, FeedbackSheet }
  from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider apiKey="upstep_xxx">
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}`,
  },

  expo: {
    slug: "expo",
    name: "Expo",
    category: "Mobile",
    headline: "Feedback SDK for Expo apps",
    intro:
      "Upstep's React Native SDK has no custom native modules beyond react-native-safe-area-context, so it installs cleanly in a managed Expo project, no native linking or prebuild required.",
    steps: [
      "Install: npx expo install @upstep/react-native react-native-safe-area-context",
      "Wrap your app in <FeedbackProvider apiKey=\"...\">",
      "Add <FeedbackButton /> and <FeedbackSheet />, or use useShakeToFeedback for shake-to-report",
    ],
    codeLang: "tsx",
    code: `import { FeedbackProvider, FeedbackButton, FeedbackSheet }
  from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider apiKey="upstep_xxx">
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}`,
  },
};
