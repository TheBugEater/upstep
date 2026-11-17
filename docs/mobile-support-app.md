# Upstep mobile support app

Design and implementation plan, 16 November 2026. Target: iPhone and Android.
The first implementation now lives in `apps/mobile`, with native-session and
push support in the web backend. Account-specific provisioning, deployment and
physical-device push verification remain release steps. See
[mobile setup and current boundaries](../apps/mobile/README.md).

## Product

A teammate can leave their computer, receive an alert when a customer needs a
person, open the exact conversation, understand what happened and reply.

Build a focused support companion first: inbox, conversation, project switcher,
availability and notification preferences. Keep business setup, knowledge crawling,
billing and board administration in the existing web dashboard initially.

Recommended client: React Native with Expo in `apps/mobile`, using the existing
Next.js backend and PostgreSQL. The customer-facing React Native SDK is a separate
product and does not authorize teammate access to the private inbox.

## AI and human responsibilities

| Situation | AI | Human | Notification |
| --- | --- | --- | --- |
| Routine question covered by business knowledge | Answer with sources; ask a focused clarification when needed | Can observe or take over | None by default |
| Customer explicitly asks for a person | Acknowledge the request; collect essential context without blocking the request | Claim the conversation | Alert the assigned teammate or eligible on-call team |
| Troubleshooting fails or knowledge is insufficient | Summarize the issue and attempted steps; request handoff | Investigate and reply | Alert eligible teammates |
| Account access, billing decision or another action requiring human authority | Explain the limit and request handoff; never claim to perform the action | Verify and perform the authorized action | Alert eligible teammates |
| Human has taken over | Customer-facing AI replies stop; optional private summary and draft assistance | Edit and send every reply | Customer follow-ups alert the assignee |
| Nobody accepts | Preserve the pending human request and follow-up ticket; AI may offer optional further help | Respond when reachable | Reminder or fallback according to team policy |
| Conversation resolved | No automatic unsolicited follow-up | Resolve or deliberately return to AI | Cancel stale reminders |

Explicit human requests must not require the customer to exhaust AI help. This
is a proposed change to today's AI-first escalation checks, not existing behavior.
Contact details can support asynchronous follow-up; they should not gate a live
human request when an authenticated customer or an active chat already provides
enough context.

During human handling, AI suggestions are drafts only. Ground summaries and drafts
in the customer-visible transcript and confirmed business knowledge. Preserve the
existing exclusion of private notes from model input. Label drafts clearly, never
auto-send them, and discard or flag them when a newer customer message arrives.

## First mobile experience

1. Sign in as an existing Upstep teammate and choose an authorized project.
2. Enable notifications, with a clear explanation of when alerts are sent.
3. Inbox groups: Needs a human, Assigned to me, AI handling and Resolved.
4. Tap an alert or inbox row to open the correct project and conversation.
5. Read the full transcript; later, an AI summary highlights the issue and what
   has already been tried, with references back to messages.
6. Tap Take over. Confirm server ownership before enabling reply controls.
7. Send a reply, leave a private note, reassign, create a task, resolve or explicitly
   return the conversation to AI.

The first useful release ends at a real customer receiving a human reply from a
locked-phone notification. Summary and drafting are a second increment, not a
dependency for that release.

## Existing foundations and missing pieces

| Area | Existing implementation | Required work |
| --- | --- | --- |
| Support engine | `support/service.ts`, `support/worker.ts`; AI, WAITING, HUMAN and RESOLVED states | Reuse shared service functions across web and mobile |
| Human actions | Reply, note, takeover, assign, resolve, return to AI and ticket routes | Mobile UI; atomic claim conflict handling for competing teammates |
| AI/human race | Conversation revisions invalidate pending AI work on takeover/reply | Preserve this invariant for every mobile mutation |
| Teammate identity | NextAuth Google/GitHub web sessions and project membership checks | Native sign-in handoff and revocable mobile sessions |
| Message delivery | Foreground polling; idempotent message IDs | Foreground refresh/reconnect and explicit sending/sent/failed UI |
| Inbox | Project support GET returns up to 100 conversations together with setup data | Paginated, filtered inbox endpoint and per-teammate read state |
| Notifications | PostgreSQL job queue for EMAIL and INTEGRATION | Push job type, event producers, device registry, recipient selection and receipts |
| Availability | Available flag plus 90-second foreground heartbeat expiry | Separate on-call/reachable preferences from live presence |
| Handoff | AI-first, human-first and human-only settings; escalation checks | Honor explicit requests; verify routing modes end to end |
| AI assistance | Customer-facing knowledge answers | Private summary and reply-draft endpoints, separate from automatic replies |

Paths in this table refer to `apps/web/src/lib/` unless otherwise stated. Support
records are in `apps/web/prisma/schema.prisma`; routes are under
`apps/web/src/app/api/projects/[id]/support/`.

## Authentication and access

- Keep the existing Google/GitHub account identity and membership rules. Use a
  system-browser login and short-lived, single-use code bound to PKCE and the
  approved app callback to establish a native session.
- Store mobile refresh credentials in platform secure storage. Rotate them and
  support per-device revocation; use short-lived access tokens for API requests.
- Mobile bearer sessions represent a teammate, not a publishable SDK key,
  customer support session or embedded MCP key. Check current project membership
  on every read, write and notification dispatch.
- Retain web cookie/origin protections while adding a distinct native bearer
  path. Never loosen customer SDK authorization to support the teammate app.
- Remove device registrations on sign-out/account changes. After session expiry,
  sign in before following a notification deep link; recheck current access.

## Notification and availability rules

- Trigger on a newly requested human handoff, assignment to the teammate and a
  new customer message in their human-owned conversation. Human-only routing
  must alert on the first customer message too.
- AI-handled messages stay quiet by default; a teammate can opt into all new
  conversations. Alert on AI failure/allowance exhaustion when it leaves a
  customer needing human help.
- Prefer the assigned teammate. For unassigned requests, select opted-in,
  authorized on-call teammates. Claiming closes the request for other recipients.
- Persist the business event and notification job in the same database transaction.
  Dispatch immediately after commit, with the existing cron as recovery.
- Store one delivery per event/recipient/device, deduplicate retries, coalesce
  message bursts and recheck ownership, resolution and preferences before send.
- Use Expo Push Service initially with APNs/FCM credentials. Process receipts,
  retry transient failures and disable invalid registrations. Provider acceptance
  is not proof that a teammate received or read the alert.
- Keep the durable inbox as the source of truth. Push taps carry identifiers;
  load the current authorized conversation rather than trusting payload content.
- Hide customer content on the lock screen by default. Show project and a generic
  help-needed message. Message previews can be an explicit preference.
- Suppress duplicate push when the teammate is actively reading that conversation.
  Support quiet hours and a configurable unanswered-request reminder/fallback.
- Closing the app expires live presence but preserves an explicit on-call choice.
  A registered device or successful push does not mean a human is online. Customer
  copy should say the team has been notified, not promise an immediate response.
- Do not automatically resume AI in a human-owned conversation just because the
  assignee backgrounds the app. Returning to AI requires an explicit action.

## Delivery order

1. **Backend foundations:** native sessions, device registration, paginated inbox,
   read cursors, atomic takeover, human-request routing and durable push events.
2. **Working iOS/Android app:** sign-in, project selection, inbox, transcript,
   takeover, replies, notes, assignment, resolve, notification deep links and
   notification/availability preferences. Foreground polling is sufficient here;
   WebSockets are not required for the first release.
3. **AI assistance:** private handoff summaries, source-backed editable reply
   suggestions and explicit return-to-AI controls; measure usefulness and cost.
4. **Pilot and release:** development builds on both platforms, then a small
   TestFlight/Android internal-test rollout before general distribution.

## Acceptance checks

- A human request reaches a locked iPhone and Android phone, including after the
  app is backgrounded or closed. Notification tap opens the exact conversation.
- Permission denial and provider failures leave a visible, actionable inbox item.
- Two teammates racing to claim a request see one winner and a clear conflict;
  a pending AI response never appears after the successful takeover.
- A retried mobile reply appears once. Connection loss preserves the draft and
  does not show an unacknowledged message as sent.
- On-call teammates can be alerted without being shown as live/online. Quiet
  hours, sign-out, membership removal and stale notifications behave correctly.
- New messages in a human-owned thread never restart customer-facing AI. Notes
  stay private and excluded from model input. Draft suggestions never send alone.
- Explicit human requests, AI provider failure and AI usage limits all reach a
  usable human queue. Human-only mode works without an AI provider.
- Web and mobile show the same ownership, transcript and resolution after refresh.

Track time to human acceptance and first human reply, unanswered requests, AI
resolution confirmed by customers, reopen rate and draft adoption. Define these
from durable events rather than treating AI silence or push acceptance as success.

## Platform references

- [Expo notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo push delivery, retries and receipts](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo AuthSession and PKCE](https://docs.expo.dev/versions/latest/sdk/auth-session/)

Real push verification requires platform credentials and a configured native
development build; a conversation mockup does not validate device delivery.
