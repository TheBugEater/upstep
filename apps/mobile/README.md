# Upstep mobile support

Native teammate inbox for iPhone and Android, built with Expo SDK 58. This is
separate from `packages/sdk-react-native`, which embeds customer-facing chat in
someone else's product.

Android internal preview: [download APK, version 0.1.0 (3)](https://expo.dev/artifacts/eas/DYwi-qBSnACSdMd45G9qv7lf_Kncp218pwSI2k2V1ig.apk)
or [view the Expo build](https://expo.dev/accounts/dilhangeeth/projects/upstep-support/builds/71bf235f-cedc-4144-9ba5-c74161a8fbdc).
This build includes native Firebase configuration. Its FCM v1 credential is
configured in Expo and passed Google's validation-only send check.

iPhone internal preview: [install on the registered test iPhone](https://expo.dev/accounts/dilhangeeth/projects/upstep-support/builds/a3e8ed9e-7bbd-4d25-ae88-9b6b505da35a).
Apple signing and the APNs push key are configured for this build.

Both previews include runtime server selection. The mobile-compatible backend is
deployed on `https://upstep.dev`; self-hosted servers need the backend update
before signing in. Physical-device push delivery has not yet been verified.

## Included

- Existing Google/GitHub account sign-in through the system browser; single-use
  PKCE handoff, rotating native credentials and per-device sign-out.
- Choose the server in the app before signing in or from Settings. The default
  is `https://upstep.dev`; self-hosted instances use their own HTTPS origin.
  Changing servers signs out the old account. Tokens, requests and notification
  deep links are isolated by server.
- Authorized project switching, paginated support inbox, unread indicators,
  foreground refresh and notification deep links.
- Human takeover, idempotent replies, private notes, reassignment, resolve,
  return to AI and conversation-to-task creation.
- Private AI summaries and editable draft replies. Nothing is auto-sent; private
  notes are excluded. Assistance uses the existing owner-level AI allowance.
- Opt-in project notification preferences, on-call routing, one-hour snooze,
  active-chat suppression and generic lock-screen messages.

## Notification onboarding

After sign-in, choose a workspace and complete the customer-alert setup. The app
explains human handoffs, assignments, customer replies and lock-screen privacy
before requesting the phone's notification permission. On-call coverage for new
unassigned requests is offered in the same step.

Setup confirms completion only after permission, phone registration and the
workspace preference have succeeded. If permission is blocked, it opens the
phone's notification settings and checks again when the app becomes active.
Choosing **Not now** is remembered on this phone for the selected account,
server and workspace; an inbox banner provides a way back to setup. Existing
users with alerts already working can go straight to the inbox.

## Configure the backend first

Deploy the web app with its committed `20261116120000_mobile_support` migration:

```bash
pnpm --filter @upstep/web db:generate
pnpm --filter @upstep/web exec prisma migrate deploy
```

Keep the existing minute-by-minute `/api/internal/notifications` cron running.
It recovers pending pushes and checks Expo receipts. Normal sends start immediately
after the support event commits. Set `EXPO_ACCESS_TOKEN` securely on the server if
enhanced Expo push security is enabled for the Expo project. Never put that token
in an `EXPO_PUBLIC_` variable or the app bundle.

Existing `AUTH_URL`, auth provider and AI settings still apply. Customer support
remains available on Pro/Business projects. Native sessions check current
membership and plan access rather than reusing publishable SDK or MCP keys.

For Dokploy, redeploy the web app from this updated source using the existing
Dockerfile. Its startup script applies committed migrations before starting the
server. Set `AUTH_URL` to the public HTTPS origin, for example
`https://upstep.dev` or your own domain. Confirm `GET /api/mobile/info` returns
`{"product":"upstep","mobileApiVersion":1}` before signing in from the app.
Older servers show an update-required message in the mobile app.

## Local development

Use Node 22.13 or newer. For local iOS builds, use Xcode 26.4 or newer; on this
machine Xcode 27.2 is at `/Applications/Xcode.app`, while the system default is an
older Xcode. Select the newer toolchain for a command with
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
From the repository root:

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @upstep/mobile ios
# or, with an Android emulator/device available:
pnpm --filter @upstep/mobile android
```

For an already-installed development client:

```bash
pnpm --filter @upstep/mobile dev
```

The **Change server** screen stores the chosen origin on this phone. Set the
public `AUTH_URL` on your self-hosted backend to the same origin, so login and
notification links identify the correct instance. The backend must include the
mobile routes/migration from this release. Self-hosting does not require a
separate app build.

`EXPO_PUBLIC_API_URL` optionally changes the initial default for a custom build;
otherwise it is `https://upstep.dev`. For a local
backend, use an address reachable by both the phone and the system browser;
configure `AUTH_URL` and provider callbacks consistently. HTTP is allowed only
in development builds. Credentials stored for one origin never move to another.

## Install on real phones

1. The app is linked to
   [`@dilhangeeth/upstep-support`](https://expo.dev/accounts/dilhangeeth/projects/upstep-support)
   (`b52aff91-14dc-44ed-a25d-1d3d20d57000`). For a separate Expo project, change
   `owner` and set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/mobile/.env` and the
   corresponding Expo build environment.
2. Configure Apple push/provisioning and Firebase FCM v1 credentials in that
   project. Register the Android app as `dev.upstep.support` in Firebase, and
   upload its `google-services.json` as an EAS **file** environment variable
   named `GOOGLE_SERVICES_JSON` for the relevant build environment. The app
   config reads that file path when generating the native Android project.
   Upload the private FCM v1 service-account credential through Expo's credential
   manager, not source control or chat. Both native Firebase configuration and
   server-side FCM credentials are required; rebuild the APK after adding them.
   Confirm `dev.upstep.support` is the bundle/application identifier you want
   to own before provisioning or publishing it.
3. From `apps/mobile`, use the Expo CLI account that owns the project:

   ```bash
   eas build --profile development --platform ios
   eas build --profile development --platform android
   ```

4. Install the development builds. Sign in, choose a workspace, then select
   **Enable customer alerts** during onboarding and allow the system prompt.
   Keep **On call for new requests** enabled to receive unassigned human requests.
5. Start a customer chat, ask for a person, lock/background the phone and confirm
   receipt, deep-link navigation, takeover and a real reply on both platforms.

Use native development builds, not Expo Go, for push/auth acceptance testing.
For a standalone internal test without Metro, use the `preview` build profile.
Android previews produce installable APKs; iOS previews require an Apple
distribution certificate, ad-hoc provisioning profile and a registered device.
Cloud builds and store distribution require the owner's Expo/Apple/Google account
configuration. JavaScript bundle exports do not prove physical-device delivery.

## Checks

```bash
pnpm type-check
pnpm --filter @upstep/mobile exec expo install --check
pnpm --filter @upstep/mobile export
pnpm test
```

To include integration tests, supply `UPSTEP_INVITATION_TEST_DATABASE_URL` pointing
at a disposable, migrated PostgreSQL database whose name ends in `_test`. Set
`DATABASE_URL` to that same database for suites using the shared Prisma client.

## Current boundaries

Open conversations poll every 2.5 seconds; the inbox refreshes every 5 seconds
while active. On-call status is independent of foreground presence. Human-owned
or explicitly requested conversations do not silently resume AI when a phone
backgrounds. AI summaries use the latest 20 customer-visible messages.

Drafts survive connection loss and navigation while the app is running; drafts
are not yet persisted across process termination. There are no attachments,
background offline message sending, scheduled quiet hours or unanswered-request
reminders in this version. Push is best effort: provider acceptance is not proof
of device delivery or a human reading it; the durable inbox remains authoritative.
Transient send failures retry, and invalid device registrations are disabled from
provider responses/receipts. Receipt-only failures are recorded for diagnosis.

Reference: [Expo notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/),
[push delivery and receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
