# Google Chat issue discussions

Google Chat is a project integration on Pro and Business, alongside Slack, Discord
and webhooks. The project owner and admins can manage connections. Each connection
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
in UpStep's owner/admin settings, rather than sharing it in issues or chat.
See [Google's webhook setup guide](https://developers.google.com/workspace/chat/quickstart/webhooks).

## Team workflow

A new issue posts its title, description and a link to the exact UpStep issue.
The opening message and card heading use the issue title so Chat's thread preview
identifies the task. The subtitle identifies the project and issue type; an update
preview identifies the event and comment author. Previously posted
messages keep their original headings; incoming webhooks only create messages.
Teammates reply in that Google Chat thread. Selected status changes, comments and
votes join the same thread rather than starting unrelated conversations.
Custom board column names appear in status updates, including moves between two
unfinished columns. Both dashboard and MCP updates are supported.

Every card uses the same compact summary: status and assignee side by side, a
single row of colored labels, and one line previewing the update. Up to two labels
are shown with a count for any additional labels. Long status names, assignees,
labels, and previews truncate in the summary instead of adding more lines.
On narrow screens Google Chat can stack the status and assignee columns.

**Show details** expands the card's native disclosure to reveal the full task
comment (up to 2000 characters), a bounded description for opening cards, the
status transition or vote details, additional labels, and full issue context.
**Hide details** returns it to the compact summary. The issue button stays outside
the disclosure and uses the status color; names retain Chat's normal foreground
for readability. Status transitions show both the previous and new colors, and
comments identify their author. Colors, labels, and assignment are captured when
the event is queued so retries preserve its context. Older queued jobs without
that context use lifecycle status colors and omit unavailable labels. These
layouts use [Google's supported card formatting](https://developers.google.com/workspace/chat/format-messages#format_text_that_appears_in_cards)
and [collapsible card sections](https://developers.google.com/workspace/chat/api/reference/rest/v1/Card#Section).
Previously posted cards keep their original layout; the new layout applies to
future messages.

Connecting a space does not automatically post or backfill existing issues. Open
an existing task and choose **Start Google Chat discussion** to share its context
and start or continue its thread immediately. Any project teammate can do this;
only the owner and admins can configure webhook credentials. With multiple
connections, choose the space first. Repeated clicks reuse one durable delivery
job, and failed manual deliveries can be retried in the task drawer. This action
works even when the connection isn't subscribed to new-feedback notifications.
An existing issue also starts a thread on its next selected event. Disabling a connection stops future
posts. Replacing its webhook can start a fresh thread because Google scopes
thread keys to the sending webhook. Google Chat space membership controls who can
read the posted issue content; UpStep project membership is still required to
open its dashboard link.

Chat replies remain in Google Chat. Webhooks cannot read replies, synchronize them
into UpStep comments, or accept commands. Those workflows require an interactive
Google Chat app and separate account authorization.

## Delivery and verification

Events use UpStep's persistent notification queue and its scheduled retries.
Stable thread keys contain the project and issue IDs. Manual discussion starts use
a durable queue job; repeated manual clicks reuse that job. Incoming webhooks
reject the `requestId` parameter supported by the authenticated Chat API, so it
is never sent. Webhook delivery is at least once: an ambiguous network timeout
can cause a repeated message within the same thread. Google Chat rate limits
and server errors use queue retries; permanent rejections stop immediately and
show the provider explanation and a retry action in the task drawer.

Webhook URLs are validated against the Google Chat HTTPS endpoint on creation,
editing and sending. Requests cannot follow redirects. User content is escaped
and bounded for Chat cards; transport errors do not log the credential-bearing
URL. Webhook credentials follow the existing server-side integration storage
model and are accessible only through owner/admin-authorized settings.

Run `pnpm --filter @upstep/web test` for mocked transport and integration dispatch
tests. They cover event threading, direct issue links, custom status names,
untrusted content, credential validation/redaction, plan gating, rejection details and retry classification.
They do not post messages to a real space. Verify a live connection by creating
an issue in the connected project, replying to its Chat thread, then changing its
status and adding an UpStep comment. No Google Chat connection is created
automatically by a deployment.
