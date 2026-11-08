# AI and live customer support

Pro and Business projects have a **Customer support** section. Enter a public
HTTPS domain (the business name is detected when available), choose routing, and review the learned business details before enabling support. Add the embed
from its Settings tab (`https://upstep.dev/sdk/upstep.js`). The hosted script is
built from the repository SDK during deployment; no npm publish is required.
Existing installed npm SDK versions must be updated separately. The business
website and its subdomains can embed support; crawling stays on the public
business domain or its www alias.

## First release

- Anonymous browser chat; optional contact name/email; signed-in customer sessions.
- AI-first, human-first (60-second fallback), or human-only routing.
- Shared inbox, assignment, availability heartbeats, private notes, resolve/reopen.
- AI creates private tickets for unresolved issues when the team is offline and
  continues helping. Tickets have stable UP- references and show the confirmed
  business support email. Repeated requests reuse the same ticket. Transcripts
  are not exposed by public feedback/roadmap APIs.
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

AI can queue a ticket automatically when an unresolved issue requires follow-up
and no teammate is available. Customers and teammates can also create one directly. Private notes stay out of customer responses and model context. Human
replies/takeover increment a revision so in-flight AI replies cannot land afterward.

The public integration guide lives at `/guides/customer-support`.

## Guided business setup

New projects can start with a website instead of a project name. Paid accounts
begin crawling immediately in draft: support stays disabled until an admin reviews
and confirms the information. The AI analysis suggests a summary, up to six facts
with sources, and at most three questions about business-specific gaps. The form
confirms the support email and assistant scope separately. Unsupported source URLs
and invented contact emails are removed from the draft analysis. Confirmed summaries,
facts and answers are separate from automatically crawled pages and are included in
support responses. Domain changes invalidate the old profile and disable support
until the new business is reviewed. Failed analysis can be retried using existing
pages; manual review remains available. Account-level website-learning allowances
are 20 runs/month on Pro and 100 on Business, separate from customer AI replies.

`@upstep/js@0.6.0` and `@upstep/types@0.6.0` ship chat in the existing JavaScript and
React widget. `chat` defaults to true; `chat:false` hides it without a discovery
request. React FeedbackWidget also accepts `chat={false}`. Script embeds accept
`data-chat="false"`. Every case still requires paid, enabled project access on the
server. The npm CDN bundle is `dist/upstep.global.js`; the hosted equivalent is
`https://upstep.dev/sdk/upstep.js`.

## Scope controls

Before generating a customer answer, the default provider checks the latest request
against the confirmed business description and support responsibilities. Unrelated
requests and role/prompt extraction attempts get a brief business-support redirect.
The structured answer also requires `inScope`; the server replaces off-topic output
and discards its ticket, handoff and citation flags. If the scope check fails, the
system does not create a ticket as an error fallback. New providers should implement
`checkScope` and the required `inScope` answer field. Private notes remain excluded.

The polished existing widget frame is published in `@upstep/js@0.6.1`; shared types
remain `@upstep/types@0.6.0`. Both vanilla and React widgets use one compact navigation
bar and the same hosted support experience, including the white/black themes.
