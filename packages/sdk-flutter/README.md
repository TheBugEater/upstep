# upstep_flutter

The [Upstep](https://upstep.dev) feedback SDK for Flutter: a floating launcher and a bottom sheet with a voting board and submit form, backed by the same project as your web app.

## Install

```bash
flutter pub add upstep_flutter
```

Get an API key by creating a free project at [upstep.dev](https://upstep.dev).

## Quick start

```dart
import 'package:flutter/material.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Upstep(
        apiKey: 'upstep_xxx',
        child: Scaffold(
          appBar: AppBar(title: const Text('Upstep demo')),
          body: Stack(
            children: const [
              Center(child: Text('Your app')),
              FeedbackSheet(),
              FeedbackButton(),
            ],
          ),
        ),
      ),
    );
  }
}
```

Same idea as the web and React Native SDKs: one package, one project API key, one shared board for feedback across every client you ship.

## Configuration

`Upstep` accepts:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `String` | — | Required. Your project's API key. |
| `userId` | `String?` | `null` | End-user id from your app for vote dedupe. |
| `baseUrl` | `String` | `https://upstep.dev` | Only needed for self-hosted or staging setups. |
| `accentColor` | `Color?` | `null` | Overrides the launcher and primary action color. |
| `themeMode` | `UpstepThemeMode` | `auto` | `light`, `dark`, or `auto`. |
| `child` | `Widget` | — | Your app subtree. |

## API

- `Upstep(...)` wraps your app and provides the controller.
- `FeedbackButton()` renders a floating launcher that opens the sheet.
- `FeedbackSheet()` listens for open/close state and shows the modal bottom sheet.
- `Upstep.of(context)` returns the `UpstepController`.
- `UpstepController.identify(userId)` updates the current user after login.
- `UpstepController.openSheet()` / `closeSheet()` open or close the sheet from your own UI.

## Links

- [Full documentation](https://upstep.dev/#integrate)
- [Platform integration guides](https://upstep.dev/integrations)
- [Dashboard / sign up](https://upstep.dev/login)

## Native support chat

Version 0.2.1 includes a native Support tab in the existing feedback sheet. Enable Customer support for a paid project in UpStep. No WebView or second widget is needed.

```dart
Upstep(
  apiKey: 'YOUR_PROJECT_KEY',
  chat: true, // defaults to true; false hides support
  supportIdentityToken: signedToken, // optional backend-signed customer JWT
  child: yourApp,
)
```

For signed-in customers, generate a short-lived project-scoped JWT on your authenticated backend with the signing secret from Support settings. Never ship that secret in the mobile app. Update `supportIdentityToken` when the customer changes and set it to `null` on logout, or call `Upstep.of(context).identifySupport(token)`. Feedback `userId` does not grant private chat access. Anonymous sessions persist in SharedPreferences; signed identity tokens are never persisted.

Chat supports compact quick replies, issue details and resolution confirmations near the composer. Contact details use two short steps and optional issue fields start collapsed. After AI understands an issue it cannot solve, the customer can ask the team by entering their name and email. A private ticket records the issue and provides a reference and business contact email. AI help does not require contact details.
