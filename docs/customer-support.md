# AI and live customer support

Pro and Business projects have a **Customer support** section. Enter a public
HTTPS domain (the business name is detected when available), choose routing, and enable support. Add the embed
from its Settings tab (`https://upstep.dev/sdk/upstep.js`). The hosted script is
built from the repository SDK during deployment; no npm publish is required.
Existing installed npm SDK versions must be updated separately. The business
website and its subdomains can embed support; crawling stays on the public
business domain or its www alias.

## First release

- Anonymous browser chat; optional contact name/email; signed-in customer sessions.
- AI-first, human-first (60-second fallback), or human-only routing.
- Shared inbox, assignment, availability heartbeats, private notes, resolve/reopen.
- Customer-confirmed private tickets linked to the existing task board. Creation
  is idempotent; transcripts are not exposed by the public feedback/roadmap APIs.
- Read-only website knowledge with source links, sitemap/link discovery,
  robots.txt, weekly indexing, manual refresh (five-minute cooldown).
- No automatic customer email delivery, inbound email, uploads, account actions,
  external knowledge connectors or JavaScript page rendering in this release.

## Server configuration

Set `OPENAI_API_KEY` at runtime. Defaults are `SUPPORT_AI_PROVIDER=openai` and
`SUPPORT_AI_MODEL=gpt-6-luna`. The OpenAI adapter uses Responses, structured JSON,
`store:false`, and bounded context/output. It never passes private notes to AI.
A server-controlled `SUPPORT_AI_BASE_URL` and `SUPPORT_AI_API_KEY` can point the
`openai-compatible` adapter at a different provider (Chat Completions + strict
JSON schema required). For another API protocol, implement `SupportAIProvider`
and register it in `src/lib/support/ai.ts`. No chat or retrieval changes needed.

Database migrations must be deployed before serving the new release. The existing
minute-by-minute `/api/internal/notifications` cron also processes support work.
Next.js `after()` starts immediate work after messages/setup; database locks,
revisions and durable pending state allow cron recovery after restarts. Messages
poll every 2.5 seconds while the chat is open. This release does not use WebSockets.

## Usage and isolation

Allowances are shared by all projects belonging to one billed owner, per UTC month:
Pro: 300 AI reply attempts and 40 pages/project. Business: 1,500 attempts and
150 pages/project. Provider calls reserve allowance atomically; failed or discarded
calls still consume an attempt because they can incur provider charges. Human chat
continues at the AI allowance limit. Downgrades are enforced on server requests and
workers. Disabled support keeps records, but closes customer SDK access.

Conversation state and messages are separate from public feedback. Bearer session
secrets are random, stored only as SHA-256 hashes, and expire after 30 days. Public
project keys or typed email addresses never authorize access to customer history.
Optional HS256 identity JWTs use project-specific backend secrets and a maximum
15-minute lifetime; require `sub`, `aud`, `iat`, `exp`. The owner copies the signing
secret from support Settings. `SUPPORT_IDENTITY_SECRET` can be a stable deployment
root; otherwise `AUTH_SECRET` derives each project's unique signing secret.
`Upstep.identifySupport(token)` updates the hosted widget; clear it on logout.
React providers accept `supportIdentityToken`. Identity switching clears local chat
state; browser storage is optional and anonymous history is device-specific.

Crawl fetches are HTTPS-only, same domain or www alias, DNS-pinned to public IPs,
redirect-checked and bounded in time, response size and page count. Private address
ranges and common authenticated routes are excluded. Knowledge generations isolate
changed domains and refreshes; retrieval only reads the current project generation.
Full-text retrieval uses PostgreSQL and relevant passages; changing AI provider
never requires re-embedding content. Old generations are retained, not searched.
Conversation and knowledge retention/deletion controls are future work.

AI can propose a ticket, but only a customer confirmation or authenticated teammate
creates it. Private notes stay out of customer responses and model context. Human
replies/takeover increment a revision so in-flight AI replies cannot land afterward.

The public integration guide lives at `/guides/customer-support`.
