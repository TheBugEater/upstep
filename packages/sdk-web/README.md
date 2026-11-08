# @upstep/js

A feedback widget for web apps: a floating button, a voting board, and a submit form, backed by your [Upstep](https://upstep.dev) project. Drops into React, Next.js, Vue, Nuxt, SvelteKit, vanilla JS, or a plain HTML page with no build step, in two lines of code.

## Install

```bash
npm install @upstep/js
```

Get an API key by creating a free project at [upstep.dev](https://upstep.dev) — no credit card required.

## Quick start

### React

```tsx
import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

export default function App({ children }) {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      {children}
      <FeedbackWidget />
    </UpstepProvider>
  );
}
```

### Vanilla JavaScript

```js
import Upstep from "@upstep/js";

// Mounts the feedback button automatically
Upstep.init({ apiKey: "upstep_xxx" });
```

### Vue / Nuxt / SvelteKit

```ts
import Upstep from "@upstep/js";

Upstep.init({ apiKey: "upstep_xxx" });
```

Mount that once from the client-side root for your framework:
- Vue: `onMounted()` in `App.vue`
- Nuxt: `plugins/upstep.client.ts`
- SvelteKit: `onMount()` in `src/routes/+layout.svelte`

### No build step (WordPress, Webflow, Shopify, static HTML)

```html
<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/upstep.global.js"
  data-api-key="upstep_xxx"
></script>
```

All of these report to the same project, so feedback from your React app, your Nuxt marketing site, a script tag on a static page, and (if you add [`@upstep/react-native`](https://www.npmjs.com/package/@upstep/react-native) or [`upstep_flutter`](https://pub.dev/packages/upstep_flutter)) your mobile app all land on one board, sorted by votes.

## Configuration

Every entry point (`Upstep.init`, `<UpstepProvider>`, and the script tag's `data-*` attributes) takes the same options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | **Required.** Your project's API key. |
| `userId` | `string` | — | End-user id from your app, used to deduplicate votes per user. Call `identify(userId)` if it's only known after login. |
| `baseUrl` | `string` | `https://upstep.dev` | Only needed for self-hosted or staging setups. |
| `accentColor` | `string` | `#D97757` | Any CSS color, used for the launcher button and highlights. |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | `"auto"` follows the host page's `prefers-color-scheme`. |
| `position` | `"left" \| "right"` | `"right"` | Deprecated. Website launchers and panels stay bottom-right. |
| `launcher` | `boolean` | `true` | Set `false` to hide the floating button and trigger the widget yourself via `Upstep.open()`. |

## API

### Vanilla / script-tag (`Upstep` default export)

- `Upstep.init(config)` — mounts the widget, returns the underlying API client.
- `Upstep.open()` / `Upstep.close()` — open or close the widget from your own UI (e.g. a nav link).
- `Upstep.identify(userId)` — set or update the end-user id after the widget has mounted.
- `Upstep.client` — the raw `UpstepApiClient` instance, if you want to call the API directly.

### React (`@upstep/js/react`)

- `<UpstepProvider apiKey="..." />` — wraps your app, all `UpstepConfig` options are valid props.
- `<FeedbackWidget position? accentColor? theme? hideLauncher? />` — the launcher button and panel. Renders nothing until it's shown; safe to mount once near the root.
- `useUpstep()` — the same state and actions the widget uses (`feedItems`, `submit`, `vote`, `open`, `close`, `identify`, ...), if you want to build your own UI on top instead of the default widget.

## Links

- [Full documentation](https://upstep.dev/#integrate)
- [Platform integration guides](https://upstep.dev/integrations)
- [Dashboard / sign up](https://upstep.dev/login)
- [@upstep/react-native](https://www.npmjs.com/package/@upstep/react-native) for React Native apps
- [upstep_flutter](https://pub.dev/packages/upstep_flutter) for Flutter apps

### AI and live chat in the existing widget

Version 0.7.2 includes a **Support** tab to the same widget that handles feedback and
voting. Enable customer support for your paid project in the UpStep dashboard,
learn the business website, and confirm the business details and contact email.
The project must be enabled on the server; `chat: true` never bypasses plan access.
Chat is shown automatically by default when the project has enabled support.

```ts
import Upstep from '@upstep/js';
Upstep.init({ apiKey: 'YOUR_PROJECT_KEY', chat: true });
// Use chat: false to keep this embed focused on feedback and voting.
```

```tsx
import { UpstepProvider, FeedbackWidget } from '@upstep/js/react';
<UpstepProvider apiKey="YOUR_PROJECT_KEY" chat={true}>
  <FeedbackWidget />
</UpstepProvider>
// FeedbackWidget also accepts chat={false} to hide chat in that widget.
```

```html
<script defer src="https://unpkg.com/@upstep/js@0.7.2/dist/upstep.global.js"
  data-api-key="YOUR_PROJECT_KEY" data-chat="true"></script>
```

When no teammate is available, AI continues helping from the business's website
and confirmed answers. Unresolved issues can become private tickets with stable
references and the business's confirmed support email. AI help needs no contact details. Before a team handoff, the customer confirms their name and email.
For private cross-device customer history, pass a backend-signed JWT as
`supportIdentityToken`, or call `Upstep.identifySupport(token)` after login and
`Upstep.identifySupport(undefined)` on logout. Never put the identity signing
secret in browser code. [Integration guide](https://upstep.dev/guides/customer-support).

### Widget layout and support forms

The website launcher and its opened chat/feedback panel stay in the bottom-right corner. Position options and old drag positions no longer move website widgets. Text uses a readable size with softer surfaces, white light mode and black dark mode.

Support can show quick replies, issue details, resolution confirmations, and a contact card. The team action appears only after AI discusses the issue and tries to help, or establishes that a human must perform the action. Asking for an agent alone never opens a contact form. Active cards stay near the composer, contact details use two short steps, and optional issue fields expand only when needed. The server requires a name and valid email before queueing a private ticket. AI replies stay short, with separate paragraphs and no em dashes.

A DOM-free client is available from `@upstep/js/support` for custom native integrations. The React Native SDK uses this same client inside its existing feedback sheet.

Business branding comes from Customer support → Settings in UpStep. Website learning detects a business icon for review; you can replace it with an upload or public image URL. The approved icon is shared by the web and native chat widgets. Setup questions offer suggested choices when appropriate, with a custom answer field.
