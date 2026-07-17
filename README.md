# Upstep

Open-source product feedback, voting, roadmaps and an MCP server for coding
agents. Add a web or mobile SDK, collect requests in one workspace and let your
team—or a project-scoped AI agent—triage what comes in.

[Website](https://upstep.dev) · [Documentation](DOCUMENTATION.md) ·
[Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## What is included

- Feedback widgets for web, React, React Native and Flutter.
- Public voting with identified and anonymous-user deduplication.
- Moderation, custom statuses, labels and filtered boards.
- Public roadmaps.
- Slack, Discord, generic webhook and email notifications.
- Project-scoped MCP tools for feedback triage and internal agent work.
- Multi-user projects and optional Stripe billing.
- PostgreSQL-backed rate limiting and durable notification retries; Redis is
  not required.

## Security model

Upstep deliberately uses two different project credentials:

- **Publishable SDK key (`upstep_pk_…`)** — expected to be embedded in browser
  and mobile applications. It can access only the public feedback API.
- **Private MCP key (`upstep_mcp_…`)** — grants project-scoped read/write MCP
  access. It is returned once, stored only as a SHA-256 digest and must remain
  in a secret store.

Never use a publishable key as an authorization boundary for private data.

## Quick start with Docker

Requirements: Docker with Compose.

```bash
git clone https://github.com/TheBugEater/upstep.git
cd upstep
cp apps/web/.env.example apps/web/.env
docker compose up --build
```

Open `http://localhost:3000`. Before signing in, create either a GitHub or
Google OAuth application and add its client ID and secret to `apps/web/.env`.
For GitHub, use this callback URL:

```text
http://localhost:3000/api/auth/callback/github
```

The Compose setup starts PostgreSQL, applies every Prisma migration, starts the
web app and periodically processes notification retries.

## Local development

Requirements: Node.js 20+, Corepack/pnpm 10 and PostgreSQL 16+.

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env
docker compose up -d postgres
pnpm --filter @upstep/web exec prisma migrate deploy
pnpm dev
```

Useful checks:

```bash
pnpm test
pnpm type-check
pnpm build
```

Do not use `prisma db push` for a change intended to ship. Update the Prisma
schema and commit a migration.

## Configuration

The complete template is [apps/web/.env.example](apps/web/.env.example).

Required for a useful installation:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL connection |
| `DIRECT_URL` | Direct PostgreSQL connection used by migrations |
| `AUTH_SECRET` | Auth.js signing secret |
| `AUTH_URL` | Public base URL of this installation |
| One OAuth provider | `GITHUB_*` or `GOOGLE_*` credentials |
| `CRON_SECRET` | Protects the notification retry endpoint |

Optional services:

| Variables | Feature |
| --- | --- |
| `RESEND_*` | Transactional email |
| `STRIPE_*` | Hosted plan billing |
| `NEXT_PUBLIC_ONRAMP_API_KEY` | Upstep Cloud product analytics; blank by default for self-hosters |
| `NEXT_PUBLIC_UPSTEP_*` | Dogfooding widget on the Upstep marketing site |

In production, call `POST /api/internal/notifications` every minute with
`Authorization: Bearer $CRON_SECRET`. New jobs are also processed immediately,
but the scheduled call guarantees recovery after restarts.

## Repository layout

```text
apps/web/                    Next.js dashboard, API, MCP and marketing site
packages/sdk-web/            @upstep/js
packages/sdk-react-native/   @upstep/react-native
packages/sdk-flutter/        upstep_flutter
packages/types/              @upstep/types
```

## Deployment

`railway.toml` provides the Upstep Cloud deployment. Any platform capable of
running a Node.js container and PostgreSQL can self-host the same application.
Run `prisma migrate deploy` before starting each release and configure the
notification retry request described above.

Back up the database and test restores. Rotating a publishable SDK key breaks
installed clients until they are updated; rotating an MCP key immediately
disconnects existing agents.

## Telemetry

Self-hosted Upstep sends no Upstep product analytics when
`NEXT_PUBLIC_ONRAMP_API_KEY` is blank, which is the default. OAuth providers,
Stripe, Resend and user-configured integrations receive data only when those
features are configured and used.

## Licensing

The server application is open source under AGPL-3.0-only. The independently
distributed SDK and shared-type packages remain MIT licensed. The Upstep name
and logos are covered by the [trademark policy](TRADEMARKS.md).

See [LICENSING.md](LICENSING.md) for the exact boundaries.
