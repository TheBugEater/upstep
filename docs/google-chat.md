# Google Chat issue discussions

Google Chat is a project integration on Pro and Business, alongside Slack, Discord
and webhooks. Only the project owner can manage connections. Each connection
targets one Google Chat space; multiple connections are supported.

## Connect a space

1. Open a Google Chat space. In its menu, choose **Apps & integrations → Add
   webhooks** and name the webhook **UpStep**.
2. In UpStep, open **Project → Integrations → Google Chat**. Paste the webhook URL
   into the private URL field and connect it.
3. New issues, status changes and UpStep comments are selected by default. Votes
   are optional. Save the events you want the team to receive.

A Business or Enterprise Google Workspace account and an administrator policy
allowing incoming webhooks are required. The URL contains credentials: enter it
in UpStep's owner-only settings, rather than sharing it in issues or chat.
See [Google's webhook setup guide](https://developers.google.com/workspace/chat/quickstart/webhooks).

## Team workflow

A new issue posts its title, description and a link to the exact UpStep issue.
Teammates reply in that Google Chat thread. Selected status changes, comments and
votes join the same thread rather than starting unrelated conversations.
Custom board column names appear in status updates, including moves between two
unfinished columns. Both dashboard and MCP updates are supported.

Connecting a space does not post or backfill existing issues. An existing issue
starts a thread on its next selected event. Disabling a connection stops future
posts. Replacing its webhook can start a fresh thread because Google scopes
thread keys to the sending webhook. Google Chat space membership controls who can
read the posted issue content; UpStep project membership is still required to
open its dashboard link.

Chat replies remain in Google Chat. Webhooks cannot read replies, synchronize them
into UpStep comments, or accept commands. Those workflows require an interactive
Google Chat app and separate account authorization.

## Delivery and verification

Events use UpStep's persistent notification queue and its scheduled retries.
Stable thread keys contain the project and issue IDs. Each destination receives
a stable Google Chat `requestId` based on the queue job ID and integration ID, so
retrying an identical delivery doesn't create a duplicate message. Google Chat
rate limits (including its per-space quota) are handled by queue retries.

Webhook URLs are validated against the Google Chat HTTPS endpoint on creation,
editing and sending. Requests cannot follow redirects. User content is escaped
and bounded for Chat cards; transport errors do not log the credential-bearing
URL. Webhook credentials follow the existing server-side integration storage
model and are accessible only through owner-authorized settings.

Run `pnpm --filter @upstep/web test` for mocked transport and integration dispatch
tests. They cover event threading, direct issue links, custom status names,
untrusted content, credential validation/redaction, plan gating and retry IDs.
They do not post messages to a real space. Verify a live connection by creating
an issue in the connected project, replying to its Chat thread, then changing its
status and adding an UpStep comment. No Google Chat connection is created
automatically by a deployment.
