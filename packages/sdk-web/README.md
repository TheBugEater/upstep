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
  src="https://unpkg.com/@upstep/js/dist/index.js"
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
| `position` | `"left" \| "right"` | `"right"` | Which corner the launcher button docks to. |
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
