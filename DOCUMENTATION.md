# Upstep — Documentation

Upstep is a drop-in feedback & voting widget for web and mobile apps, plus a
dashboard to triage what comes in. Embed an SDK with your project's API key,
collect feedback, let users vote, and manage it from a hosted dashboard.

> This document describes what is actually implemented in this repository. Code
> references are linked relative to the repo root.

---

## Contents

1. [Repository structure](#repository-structure)
2. [Tech stack](#tech-stack)
3. [Local setup](#local-setup)
4. [Environment variables](#environment-variables)
5. [Authentication](#authentication)
6. [Plans & limits](#plans--limits)
7. [Billing (Stripe)](#billing-stripe)
8. [SDKs](#sdks)
9. [Widget configuration](#widget-configuration)
10. [Identifying users](#identifying-users)
11. [Triggering the widget yourself](#triggering-the-widget-yourself)
12. [Moderation](#moderation)
13. [REST API reference](#rest-api-reference)
14. [Data model](#data-model)
15. [Dashboard](#dashboard)
16. [Scripts](#scripts)

---

## Repository structure

This is a [Turborepo](https://turbo.build) + [pnpm](https://pnpm.io) monorepo.

```
upstep/
├── apps/
│   └── web/                  # Next.js 15 app — dashboard, auth, REST API
├── packages/
│   ├── types/                # @upstep/types — shared TypeScript types
│   ├── sdk-web/              # @upstep/js — web widget (vanilla + React)
│   └── sdk-react-native/     # @upstep/react-native — RN widget
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

Workspaces are `apps/*` and `packages/*`. Packages reference each other with
`workspace:*`.

---

## Tech stack

| Area      | Technology                   |
| --------- | ---------------------------- |
| Framework | Next.js 15.1.6 (App Router)  |
| UI        | React 19, Tailwind CSS 3     |
| Auth      | NextAuth / Auth.js v5 (beta) |
| Database  | PostgreSQL via Prisma 6      |
| Billing   | Stripe                       |
| Monorepo  | Turborepo, pnpm 10           |
| Runtime   | Node.js ≥ 20                 |

Fonts are loaded with `next/font`: Inter (sans), Source Serif 4 (serif),
JetBrains Mono (mono) — see [apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx).

---

## Local setup

**1. Install dependencies** (from the repo root):

```bash
pnpm install
```

**2. Start a Postgres database.** Any Postgres works; for local dev:

```bash
docker run -d --name upstep-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=upstep \
  -p 5432:5432 postgres:16
```

**3. Configure env.** Copy the example and fill it in:

```bash
cp apps/web/.env.example apps/web/.env
```

Generate an auth secret with `openssl rand -base64 32`. See
[Environment variables](#environment-variables).

**4. Push the schema** to the database:

```bash
cd apps/web
pnpm db:push
```

**5. Run the dev server** (from the repo root):

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Environment variables

Defined in [apps/web/.env.example](apps/web/.env.example). All live in
`apps/web/.env`.

| Variable                                    | Required | Purpose                                          |
| ------------------------------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`                              | Yes      | Postgres connection string (pooled)              |
| `DIRECT_URL`                                | Yes      | Direct Postgres connection (used for migrations) |
| `AUTH_SECRET`                               | Yes      | NextAuth session encryption secret               |
| `AUTH_URL`                                  | Yes      | App base URL, e.g. `http://localhost:3000`       |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth login                               |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth login                               |
| `STRIPE_SECRET_KEY`                         | Optional | Enables billing/checkout                         |
| `STRIPE_WEBHOOK_SECRET`                     | Optional | Verifies Stripe webhook signatures               |
| `STRIPE_PRICE_PRO`                          | Optional | Stripe price id for the Pro plan                 |
| `STRIPE_PRICE_BUSINESS`                     | Optional | Stripe price id for the Business plan            |

If the Stripe variables are blank, the app still runs: checkout returns a
"billing not configured" response and plan limits are still enforced (everyone
is on Free).

---

## Authentication

Auth is configured in [apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts)
using NextAuth v5 with the Prisma adapter and JWT sessions.

Sign-in providers: **GitHub** and **Google** (OAuth only). There is no
email/password login. The sign-in page is at `/login`; `/register` redirects to
`/login`.

---

## Plans & limits

Defined in [apps/web/src/lib/plans.ts](apps/web/src/lib/plans.ts).

| Plan         | Projects  | Feedback / project | Branding badge |
| ------------ | --------- | ------------------ | -------------- |
| **Free**     | 1         | 100                | Shown          |
| **Pro**      | 10        | 5,000              | Removed        |
| **Business** | Unlimited | Unlimited          | Removed        |

**Pricing** (per month, billed in the visitor's currency):

| Plan     | USD | GBP | EUR |
| -------- | --- | --- | --- |
| Pro      | $19 | £15 | €18 |
| Business | $99 | £79 | €95 |

Limits are enforced server-side:

- **Project cap** — [apps/web/src/app/api/projects/route.ts](apps/web/src/app/api/projects/route.ts)
  returns HTTP `402` with `code: "PROJECT_LIMIT"` when the account is at its
  project limit.
- **Feedback cap** — [apps/web/src/app/api/sdk/feedback/route.ts](apps/web/src/app/api/sdk/feedback/route.ts)
  returns HTTP `402` when a project reaches its feedback limit.

---

## Billing (Stripe)

### Currencies

Pricing supports **USD, GBP, EUR**. The visitor's currency is detected in
[apps/web/src/lib/currency.ts](apps/web/src/lib/currency.ts), in priority order:

1. `upstep_currency` cookie (set by the on-page currency switcher)
2. Geo IP country header (`x-vercel-ip-country` or `cf-ipcountry`)
3. `Accept-Language` header
4. USD fallback

Each plan is a single Stripe Price with multi-currency `currency_options`, so
one `STRIPE_PRICE_*` env var per plan covers all three currencies. The chosen
currency is passed to Stripe Checkout.

### Creating Stripe prices

The script [apps/web/scripts/create-stripe-prices.ts](apps/web/scripts/create-stripe-prices.ts)
creates (or reuses) the Stripe Products and multi-currency Prices, then prints
the env vars to copy into `.env`.

```bash
cd apps/web
pnpm stripe:prices
```

Requires `STRIPE_SECRET_KEY`. It is idempotent — products and prices are tagged
with an `upstep_plan` metadata key and reused on re-run.

### Routes

| Route                  | Method | Purpose                                                |
| ---------------------- | ------ | ------------------------------------------------------ |
| `/api/checkout`        | POST   | Creates a Stripe Checkout session for `PRO`/`BUSINESS` |
| `/api/billing/portal`  | POST   | Opens the Stripe billing portal to manage/cancel       |
| `/api/webhooks/stripe` | POST   | Syncs the user's plan from Stripe events               |

The webhook ([apps/web/src/app/api/webhooks/stripe/route.ts](apps/web/src/app/api/webhooks/stripe/route.ts))
handles `checkout.session.completed`, `customer.subscription.created/updated`,
and `customer.subscription.deleted`, mapping the active price back to a plan.

For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the printed signing secret in `STRIPE_WEBHOOK_SECRET`.

---

## SDKs

All published on npm under the `@upstep` scope.

### `@upstep/js` (web)

```bash
npm install @upstep/js
```

**Vanilla JS** — the floating Feedback button mounts automatically on `init`:

```js
import Upstep from "@upstep/js";

Upstep.init({ apiKey: "upstep_xxx" });
```

Exposes `Upstep.init(config)` and `Upstep.client` (an `UpstepApiClient`).

**React** (subpath `@upstep/js/react`):

```tsx
import { UpstepProvider, FeedbackWidget } from "@upstep/js/react";

function App({ children }) {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      {children}
      <FeedbackWidget />
    </UpstepProvider>
  );
}
```

Exports: `UpstepProvider`, `FeedbackWidget`, `useUpstep()`.

**Script tag** — the package is served by unpkg after publish; the auto-init
reads `data-*` attributes:

```html
<script
  type="module"
  src="https://unpkg.com/@upstep/js/dist/index.js"
  data-api-key="upstep_xxx"
  data-base-url="https://your-upstep-url"
  data-accent-color="#D97757"
  data-position="right"
></script>
```

Supported attributes: `data-api-key`, `data-user-id`, `data-base-url`,
`data-accent-color`, `data-position`, `data-theme`.

### `@upstep/react-native`

```bash
npm install @upstep/react-native
```

Peer dependencies: `@gorhom/bottom-sheet`, `react-native-reanimated`,
`react-native-gesture-handler`, `react`, `react-native`.

```tsx
import {
  FeedbackProvider,
  FeedbackButton,
  FeedbackSheet,
} from "@upstep/react-native";

export default function App() {
  return (
    <FeedbackProvider
      apiKey="upstep_xxx"
      userId={currentUser?.id} // optional — ties votes to this user
      accentColor="#D97757" // optional
      theme="auto" // "light" | "dark" | "auto"
    >
      {/* your app */}
      <FeedbackButton />
      <FeedbackSheet />
    </FeedbackProvider>
  );
}
```

Exports: `FeedbackProvider`, `FeedbackButton`, `FeedbackSheet`,
`useShakeToFeedback()`, `useUpstep()`.

#### FeedbackSheet screens

The sheet contains three built-in screens with client-side navigation — no
React Navigation or Expo Router needed.

| Screen          | Description                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Feed list**   | Scrollable list sorted by upvotes. Each card shows the title (or truncated content), upvote count, type badge, and a `›` to open the detail. Tap the upvote box to vote without opening the item. A **+ New** button in the header navigates to the create screen. |
| **Feed detail** | Full title + description, type and status badges, upvote button, and a developer-response section that renders any comments the project owner has left on the item. Pending items the user submitted themselves are visible here.                                  |
| **Create**      | Type selector (Bug report / Feature request / General), **Title** field (required, max 200 chars), and an optional **Description** field (max 2 000 chars). Submitting returns to the feed list.                                                                   |

#### FeedbackButton props

| Prop       | Type                                | Default          |
| ---------- | ----------------------------------- | ---------------- |
| `position` | `"bottom-right"` \| `"bottom-left"` | `"bottom-right"` |
| `label`    | `string`                            | `"Feedback"`     |

The button uses the provider's `accentColor`.

#### Other utilities

- `useShakeToFeedback()` — opens the sheet on a device shake (requires
  `expo-sensors`).
- `useUpstep()` — exposes `feedItems`, `vote`, `submit`, `getItem`, `openSheet`,
  `identify`, `accentColor`, `theme`.

---

## Widget configuration

`UpstepConfig` is defined in
[packages/types/src/index.ts](packages/types/src/index.ts) and accepted by
`Upstep.init`, `<UpstepProvider>`, and `<FeedbackProvider>`.

| Option        | Type                              | Default              | Notes                                                                                                         |
| ------------- | --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apiKey`      | `string`                          | —                    | **Required.** Your project's API key                                                                          |
| `userId`      | `string`                          | —                    | End-user id from your app; enables per-user vote deduplication and visibility of the user's own pending items |
| `baseUrl`     | `string`                          | `https://upstep.dev` | Point at your Upstep deployment when self-hosting                                                             |
| `accentColor` | `string`                          | `#D97757`            | Any CSS hex color for the button, tabs, and highlights                                                        |
| `theme`       | `"light"` \| `"dark"` \| `"auto"` | `"auto"`             | Panel color theme. `"auto"` follows the OS/browser `prefers-color-scheme`                                     |
| `position`    | `"left"` \| `"right"`             | `"right"`            | Launcher position (vanilla web widget only)                                                                   |

Notes on the React components:

- The web `FeedbackWidget` accepts `accentColor` and `theme` as props; if
  omitted they fall back to the values passed to `<UpstepProvider>`.
- The vanilla widget reads `accentColor` / `theme` / `position` from the `init`
  config (or `data-*` attributes for the script tag).
- **Dark mode** is built in across all three SDKs. With `theme: "auto"` the
  panel re-themes live when the user switches their OS appearance.
- **Mobile-responsive launcher** — on viewports narrower than 640 px the web
  launcher (both React and vanilla) collapses to an icon-only pill; the label is
  hidden automatically.

### Disabling the floating launcher

| SDK                        | How to disable                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React (`@upstep/js/react`) | `<FeedbackWidget hideLauncher />` — render the modal without the button, then call `const { open } = useUpstep()` from your own UI                                  |
| Vanilla JS / Script tag    | `Upstep.init({ ..., launcher: false })` — call `Upstep.open()` from your own element                                                                                |
| React Native               | Simply omit `<FeedbackButton />` — it is a separate optional component. Render `<FeedbackSheet />` alone and call `const { openSheet } = useUpstep()` from anywhere |

---

## Identifying users

`userId` ties votes to a specific end-user so a person can only vote once per
item (and can toggle their vote). It also makes the user's own `PENDING` items
visible to them while they await review.

You have two ways to provide it.

**If the user id is known at mount**, just pass it in the config:

```tsx
<UpstepProvider apiKey="upstep_xxx" userId={currentUser.id}>
```

**If the user logs in after the widget mounts** (the common case — auth resolves
asynchronously), you do **not** need to delay mounting or remount the provider.
Use one of:

- **React / React Native** — pass a changing `userId` prop; the provider keeps
  the client in sync automatically. Or call `identify()` from context:

  ```tsx
  const { identify } = useUpstep();
  useEffect(() => {
    if (user) identify(user.id);
  }, [user]);
  ```

- **Vanilla JS** — call `Upstep.identify()`:

  ```js
  Upstep.init({ apiKey: "upstep_xxx" });
  // …later, once the user logs in:
  Upstep.identify(user.id);
  ```

Without a `userId`, votes are still accepted but recorded anonymously with a
request fingerprint (no per-user uniqueness).

---

## Triggering the widget yourself

Not every app wants a floating button — you may want to open feedback from a
Settings row, a menu item, or based on app logic.

**React** — hide the launcher and open from context:

```tsx
import { UpstepProvider, FeedbackWidget, useUpstep } from "@upstep/js/react";

function SettingsRow() {
  const { open } = useUpstep();
  return <button onClick={open}>Send feedback</button>;
}

function App() {
  return (
    <UpstepProvider apiKey="upstep_xxx">
      {/* … */}
      <FeedbackWidget hideLauncher /> {/* modal only, no floating button */}
      <SettingsRow />
    </UpstepProvider>
  );
}
```

`useUpstep()` exposes `open()`, `close()`, and `isOpen`.

**Vanilla JS** — turn the launcher off and call `Upstep.open()`:

```js
Upstep.init({ apiKey: "upstep_xxx", launcher: false });

document
  .querySelector("#feedback-menu-item")
  .addEventListener("click", () => Upstep.open());
```

`Upstep` exposes `open()` and `close()` (plus `identify()` and `client`).

**React Native** — the launcher (`FeedbackButton`) is already optional. Render
the sheet and open it from anywhere:

```tsx
import {
  FeedbackProvider,
  FeedbackSheet,
  useUpstep,
} from "@upstep/react-native";

function SettingsRow() {
  const { openSheet } = useUpstep();
  return (
    <Pressable onPress={openSheet}>
      <Text>Send feedback</Text>
    </Pressable>
  );
}

function App() {
  return (
    <FeedbackProvider apiKey="upstep_xxx">
      {/* no <FeedbackButton /> needed */}
      <FeedbackSheet />
      <SettingsRow />
    </FeedbackProvider>
  );
}
```

`useUpstep()` exposes `openSheet()`. `useShakeToFeedback()` is another built-in
trigger (opens the sheet on a device shake; requires `expo-sensors`).

---

## Moderation

Each project has a **Hold feedback for review** toggle (on by default). When
enabled, every new submission arrives with `status: "PENDING"` and is **not
returned by the public SDK feed** until the owner approves it.

### How it works

1. The SDK submits feedback — `POST /api/sdk/feedback`.
2. If `project.moderationEnabled` is `true`, the record is created with
   `status = "PENDING"`.
3. The profanity filter (`apps/web/src/lib/profanity.ts`) runs on the content.
   If a match is found, `flagged = true` is stored alongside the record.
4. `GET /api/sdk/feedback` always excludes `PENDING` items from the public feed,
   **except** when the caller passes their own `endUserId` as a query param — in
   that case, their own pending items are returned so they know their submission
   is in review.
5. The project owner sees a **Pending review** tab on the dashboard. Flagged
   items show a visual warning.
6. Approving sets the status to `OPEN` (immediately visible in the public feed).
   Rejecting sets it to `CLOSED`.

### Toggling moderation per project

The toggle is in the **Settings** tab of the project dashboard. It calls:

```
PATCH /api/projects/:id
{ "moderationEnabled": true | false }
```

Turning it off means new submissions go live immediately as `OPEN`.

### API key rotation

The **Settings** tab also provides an API key rotate button. This generates a
fresh key instantly:

```
POST /api/projects/:id/rotate-key
```

Response: `{ "apiKey": "upstep_..." }`

The old key stops working immediately. Update your SDK configuration with the
new key to restore the widget.

### Profanity filter

The filter in `apps/web/src/lib/profanity.ts` uses:

- A compact blocklist of common offensive terms.
- Leetspeak normalisation (`0→o`, `1→i`, `3→e`, `4→a`, `5→s`, `7→t`, `@→a`,
  `$→s`).
- Repeated-character collapse (`shiiit → shit`).
- Both a word-boundary match (avoids the "Scunthorpe problem") and a
  separator-stripped compact match (`f.u.c.k` still matches).

Flagging is additive — it does not block submission. Flagged items are
highlighted for the owner's attention during review.

---

## REST API reference

The SDK talks to the **public SDK API** under `/api/sdk`. Authentication is the
`x-api-key` request header (your project API key). These endpoints send
permissive CORS headers (`Access-Control-Allow-Origin: *`).

Base URL = your deployment (the SDK's `baseUrl`, default `https://upstep.dev`).

### List feedback

```
GET /api/sdk/feedback
```

Query parameters:

| Param       | Default | Notes                                                                                                                                                                          |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `limit`     | `20`    | Max `50`                                                                                                                                                                       |
| `cursor`    | —       | Feedback id to paginate after                                                                                                                                                  |
| `type`      | —       | `BUG` \| `FEATURE` \| `GENERAL`                                                                                                                                                |
| `status`    | —       | `OPEN` \| `IN_PROGRESS` \| `DONE` \| `CLOSED`. When omitted, `PENDING`, `CLOSED`, and `DONE` are excluded — only active (`OPEN` / `IN_PROGRESS`) items are returned by default |
| `sort`      | newest  | `votes` sorts by upvotes descending                                                                                                                                            |
| `endUserId` | —       | When provided, includes the user's own `PENDING` items                                                                                                                         |

Response: `{ "items": Feedback[], "nextCursor": string | null }`

### Get a single item (with comments)

```
GET /api/sdk/feedback/:id
```

Returns a single `FeedbackWithComments` object. Comments are developer
responses (owner-authored) included for display in the React Native detail
screen. Returns `404` if the item doesn't exist or belongs to a different
project.

Response shape:

```json
{
  "id": "...",
  "title": "Short summary",
  "content": "Full description",
  "type": "BUG",
  "status": "OPEN",
  "upvotes": 4,
  "userVote": "UP",
  "comments": [
    {
      "id": "...",
      "content": "We're looking into this.",
      "authorName": "Jane",
      "isOwner": true,
      "createdAt": "..."
    }
  ]
}
```

### Submit feedback

```
POST /api/sdk/feedback
```

Body:

```json
{
  "title": "string (optional, max 200 chars)",
  "content": "string (1–2000 chars, required)",
  "type": "BUG | FEATURE | GENERAL (optional, default GENERAL)",
  "endUserId": "string (optional)",
  "metadata": { "any": "json (optional)" }
}
```

- `title` is the short summary shown in lists; `content` is the full description.
- If `endUserId` is supplied, the submitter receives an automatic upvote on the
  item and a Vote record is created to prevent double-voting.
- Returns the created `Feedback` (`201`). Returns `402` if the project's
  feedback limit is reached.

### Vote

```
POST /api/sdk/feedback/:id/vote
```

Body: `{ "value": "UP" | "DOWN", "endUserId"?: string }`

Behavior:

- With `endUserId`: one vote per user per item. Re-sending the **same** value
  removes the vote (toggle off) → `{ "removed": true }`. Sending the **opposite**
  value flips it → `{ "flipped": true }`. A new vote returns `{ "ok": true }`
  (`201`).
- Without `endUserId`: an anonymous vote is recorded with a request fingerprint
  (no uniqueness enforced).

### Remove a vote

```
DELETE /api/sdk/feedback/:id/vote?endUserId=<id>
```

`endUserId` is required. Returns `{ "ok": true }`.

### Dashboard API (session-authenticated)

These require a logged-in session (browser cookie), used by the dashboard UI:

| Route                                      | Methods           | Notes                                             |
| ------------------------------------------ | ----------------- | ------------------------------------------------- |
| `/api/projects`                            | `GET`, `POST`     | List or create projects                           |
| `/api/projects/:id`                        | `PATCH`, `DELETE` | Update `name`/`moderationEnabled`; delete project |
| `/api/projects/:id/rotate-key`             | `POST`            | Generate a new API key, invalidating the old one  |
| `/api/projects/:id/feedback`               | `GET`             | List feedback (dashboard, with filters)           |
| `/api/projects/:id/feedback/:fid`          | `PATCH`, `DELETE` | Update `status`/`type`; delete item               |
| `/api/projects/:id/feedback/:fid/comments` | `GET`, `POST`     | List or add developer comments on an item         |

#### Developer comments

Comments are owner-authored responses left on individual feedback items. They
appear in the **Feed detail** screen of the React Native SDK and in the expanded
row of the dashboard list view.

`POST /api/projects/:id/feedback/:fid/comments` body:

```json
{ "content": "string (1–2000 chars)" }
```

Response: the created `Comment` object (`201`).

---

## Data model

Prisma schema: [apps/web/prisma/schema.prisma](apps/web/prisma/schema.prisma).

- **User** — `id`, `email`, `name`, `image`, `plan` (`FREE`/`PRO`/`BUSINESS`),
  `stripeCustomerId`, `stripeSubscriptionId`, plus NextAuth relations
  (`accounts`, `sessions`) and `projects`.
- **Project** — `id`, `name`, `apiKey` (unique), `ownerId`, `moderationEnabled`
  (boolean, default `true`), timestamps. New projects get a key shaped like
  `upstep_<random>`. The key can be rotated via `POST /api/projects/:id/rotate-key`.
- **Feedback** — `id`, `projectId`, `title` (optional short summary, max 200 chars),
  `content` (full description, required), `type` (`BUG`/`FEATURE`/`GENERAL`),
  `status` (`PENDING`/`OPEN`/`IN_PROGRESS`/`DONE`/`CLOSED`), `endUserId`,
  `upvotes`, `downvotes`, `flagged` (boolean, set by profanity filter),
  `metadata` (JSON), timestamps. Has a `comments` relation.
- **Comment** — `id`, `feedbackId`, `content`, `authorName` (project owner's
  display name), `isOwner` (always `true` for now — only the project owner can
  comment), `createdAt`. Cascade-deleted with the parent feedback.
- **Vote** — `id`, `feedbackId`, `value` (`UP`/`DOWN`), `endUserId`,
  `fingerprint`, with a unique constraint on `(feedbackId, endUserId)`.
- **Account / Session / VerificationToken** — NextAuth tables.

---

## Dashboard

The project detail page (`/dashboard/projects/[id]`) has three tabs:

### Feedback tab

A Jira-style kanban board with three columns: **Open**, **In Progress**, and **Done**.
Each card shows the title (with a content preview underneath if a title is set),
upvotes, and type badge. **Drag a card between columns to move it** — updates are
optimistic and persisted via `PATCH /api/projects/:id/feedback/:fid`.

### Pending review tab

Shows all `PENDING` items (those held by the moderation queue). Each item can
be **Approved** (→ `OPEN`, immediately public) or **Rejected** (→ `CLOSED`).
Flagged items (profanity filter match) show a visual indicator. A count badge
on the tab updates in real time as items are actioned.

### Settings tab

- **API key** — masked by default (first 8 chars + bullets). A **Reveal / Hide**
  toggle and a **Copy** button are available.
- **Rotate key** — shows a confirmation warning before calling
  `POST /api/projects/:id/rotate-key`. The new key is revealed immediately after
  rotation. The old key is invalidated instantly.
- **Hold feedback for review** — the moderation toggle. When on, new submissions
  land in the Pending tab rather than going public immediately.

---

## Scripts

Run from `apps/web` (or via `pnpm --filter @upstep/web <script>`):

| Script               | Description                                   |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | Start the Next.js dev server (Turbopack)      |
| `pnpm build`         | Production build                              |
| `pnpm start`         | Run the production build                      |
| `pnpm lint`          | Lint                                          |
| `pnpm type-check`    | `tsc --noEmit`                                |
| `pnpm db:generate`   | Generate the Prisma client                    |
| `pnpm db:migrate`    | Run Prisma migrations (dev)                   |
| `pnpm db:push`       | Push the schema to the database               |
| `pnpm db:studio`     | Open Prisma Studio                            |
| `pnpm db:seed`       | Run `prisma/seed.ts`                          |
| `pnpm stripe:prices` | Create/print Stripe prices for the paid plans |

Root scripts (Turborepo, all workspaces): `pnpm dev`, `pnpm build`,
`pnpm lint`, `pnpm type-check`.

Package build scripts: `@upstep/js` and `@upstep/react-native` build with
`pnpm --filter <pkg> build`.
