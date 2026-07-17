# @upstep/react-native

The [Upstep](https://upstep.dev) feedback SDK for React Native: a launcher button and a bottom sheet with a voting board and submit form, backed by the same project as your web app.

## Install

```bash
npm install @upstep/react-native react-native-safe-area-context
```

`react-native-safe-area-context` is a required peer dependency (the sheet needs it for safe-area insets). Get an API key by creating a free project at [upstep.dev](https://upstep.dev).

## Quick start

```tsx
import { FeedbackProvider, FeedbackButton, FeedbackSheet } from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider apiKey="upstep_xxx">
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}
```

Same idea as the web widget: a floating button opens a sheet with a voting board and a submit form. It reports to the same project and the same board as your web app, so mobile and web feedback end up in one place, sorted by votes.

## Shake to submit feedback

Optional, and only active if [`expo-sensors`](https://www.npmjs.com/package/expo-sensors) is installed:

```bash
npm install expo-sensors
```

```tsx
import { useShakeToFeedback } from "@upstep/react-native";

function App() {
  useShakeToFeedback(); // opens the sheet when the device is shaken
  // ...
}
```

If `expo-sensors` isn't installed, the hook is a no-op — safe to call unconditionally.

## Configuration

`FeedbackProvider` takes the same options as the web SDK:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | — | **Required.** Your project's API key. |
| `userId` | `string` | — | End-user id from your app, used to deduplicate votes per user. Call `identify(userId)` if it's only known after login. |
| `baseUrl` | `string` | `https://upstep.dev` | Only needed for self-hosted or staging setups. |
| `accentColor` | `string` | `#D97757` | Any CSS color, used for the launcher button and highlights. |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | `"auto"` follows the device color scheme. |

## API

- `<FeedbackProvider apiKey="..." />` — wraps your app, all config options above are valid props.
- `<FeedbackButton position? label? icon? />` — floating launcher, `position` is `"bottom-right"` (default) or `"bottom-left"`.
- `<FeedbackSheet />` — the modal sheet with the board and submit form. Mount once, anywhere inside the provider.
- `useShakeToFeedback()` — opens the sheet on a device shake, requires `expo-sensors`.
- `useUpstep()` — the underlying state and actions (`feedItems`, `submit`, `vote`, `openSheet`, `closeSheet`, `identify`, ...), if you want to build a custom UI instead of `FeedbackSheet`.

## Links

- [Full documentation](https://upstep.dev/#integrate)
- [Dashboard / sign up](https://upstep.dev/login)
- [@upstep/js](https://www.npmjs.com/package/@upstep/js) for web apps
