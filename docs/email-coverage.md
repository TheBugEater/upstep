# Transactional email coverage

Reviewed against the application code on 5 November 2026.

| Flow | Coverage |
| --- | --- |
| New feedback from the public SDK/widget | Email to the project owner, including moderation/flag state. Project members are not subscribed. |
| Project invitation | Email to any invited address, including people without accounts. Pending invitations, signup/sign-in continuation, explicit acceptance, seven-day expiry, resend and revocation are supported. |
| Transport tests | Fixed recipient smoke tests for the setup and invitation templates. |

All sends use the SendPanda helper, a send-only key and UUID idempotency keys.
Emails use UpStep Team as the sender name. The persistent outbox retries failed
requests up to five attempts. Acceptance by SendPanda means queued, not delivered.

## Remaining gaps, in suggested order

1. **Feedback replies and status/shipping updates.** Comments and status changes
   trigger Slack/Discord/webhook integrations, but no email reaches the original
   submitter or voters. Subscription/consent controls would be needed before adding
   these recipient lists.
2. **Billing notices.** The application syncs Stripe subscription events but sends
   no payment-failed, cancellation, plan-change or receipt emails. Stripe dashboard
   email settings are separate and were not audited here; do not assume the app
   or Stripe currently covers them.
3. **Delivery feedback and operator alerts.** There is no SendPanda delivery,
   bounce or complaint webhook in UpStep, and no owner-facing delivery status,
   failed-job alert or retry button. Provider-queued is currently the last state
   recorded by the application.
4. **Welcome/onboarding and invitation-accepted notices.** OAuth account creation
   and joining a project do not send a welcome email or notify the project owner
   that the invite was accepted.
5. **Member removal and security notices.** Removing access and rotating SDK/MCP
   keys do not send email alerts.
6. **Team subscriptions and preferences.** New-feedback emails go only to the
   owner. There are no per-member preferences, digests or notification settings.
   Dashboard/MCP-created feedback also does not create these owner email alerts.

Authentication is Google/GitHub OAuth only. There is no local password account
flow, so local password-reset and password-change emails are not applicable.

## Operational requirement

In-process retries stop when the app restarts. Production must also call
`POST /api/internal/notifications` periodically with `Authorization: Bearer
<CRON_SECRET>`. The endpoint and durable jobs alone do not schedule themselves.

Hosted production uses the Dokploy **UpStep notification retries** schedule every
minute against the `app` service. It runs `scripts/process-notifications.mjs`,
which reads `CRON_SECRET` from the container environment and never prints it.
Self-hosters need to configure an equivalent schedule.
