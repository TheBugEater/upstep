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
