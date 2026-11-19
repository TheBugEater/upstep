# Personal MCP access

Each teammate can generate one active personal key per project from the MCP tab.
The key belongs to that user and project, and only its SHA-256 digest is stored.
The plaintext is shown once. Generate, rotate and revoke affect that user's key
only. A project owner can also revoke another teammate's key from **Team MCP
access**; admins and members manage their own keys. Revoking a key does not remove
membership, so the teammate can generate a new one while they retain project
access. Remove their membership to end access to the project.

Authentication checks membership and current role on every request. Removing a
member clears their personal key in the same transaction as membership removal
and task unassignment. Adding that person again does not reactivate the old key.
Changing a role takes effect on their next request. Creating boards and columns
requires owner/admin access, matching the dashboard. Tasks, comments and labels
are available to project teammates.

Personal keys attach comments to the authenticated user, including their display
name and avatar. The `author_name` argument cannot override this identity. New
tasks default to the authenticated teammate. `get_project_overview` returns
`current_user` and `team_members` with IDs for assignment. `list_feedback` defaults
to that teammate's work; `assignee_id: "all"` browses the full project, `"me"`
selects their tasks, and `null` selects unassigned tasks. Creation and update
support `assignee_id: "me"`, a current teammate ID, or `null` to unassign.

People may work simultaneously. Each user has their own request allowance inside
the project's shared allowance, rather than all teammates sharing an IP-based
allowance. Separate keys do not lock tasks: read the current assignment before
taking work and coordinate before editing an item someone else is handling.

The MCP tab generates a distinct server name and environment variable per
project, so configuring another project does not replace the previous
connection's credentials. Keep keys in a secret store or local environment,
outside source control.

## Support setup through MCP

On Pro and Business projects, a personal MCP key belonging to an owner or admin
can configure customer support without the dashboard. Reconnect the MCP client if
it has a cached tool list. The tools act on the project tied to the key.

1. Call `get_support_knowledge` to inspect existing settings and indexed pages.
   For a new website, call `learn_support_website` with its public domain. Poll
   `get_support_knowledge` until learning reaches `REVIEW` or `FAILED`.
2. Verify the findings against your product docs and policies. Call
   `save_support_knowledge` with the current `generation`, the business name,
   support email, summary, instructions, welcome message, facts, and answers
   keyed by the question IDs in `findings`. If automated learning fails, the
   agent can supply those details from sources you provide. Set `enabled` to
   `true` to go live or `false` to save a draft. Use `refresh_support_knowledge`
   to reindex an enabled website without replacing confirmed facts and answers.
3. Call `list_support_connectors`, then `save_support_connector` with the complete
   connector configuration. Supply the connector `id` to edit or rename it. With
   no `id`, saving again matches the existing name case-insensitively. A saved
   credential can be reused by omitting `secret` when the URL and auth settings
   stay the same. For new credentials, use a secret source the agent is authorized
   to access and keep the value out of chat and source control. The tool returns
   `hasSecret` without exposing the value.

Connector actions use HTTPS GET. A `CUSTOMER` action must include
`{customer_id}` or `{customer_email}` in its path, populated from the verified
customer. A `PUBLIC` action should serve only public data. Use a narrowly scoped
read-only API token when a connector needs authentication.

## Existing shared keys

The additive migration leaves the existing project key active to preserve
connected clients. It is explicitly treated as `legacy_shared`, without a
human identity. Existing all-project browsing, team display names, and owner-level
setup access remain compatible. Legacy keys do not provide personal attribution
or membership-based revocation for people who know the shared key.

Each teammate should generate a personal key and replace their old shared client
connection. Once everyone has switched, the project owner can choose **Revoke
legacy shared key**. Generating or rotating personal keys never revokes the shared
key automatically. No existing production credential is changed by deployment.

## Checks

The database-backed MCP workflow test covers parallel users, independent
rotation, project boundaries, real comment authors, assignment validation, role
changes, owner-only revocation of other users' keys, membership removal and
re-invitation, safe metadata, and legacy compatibility. Tests use isolated
fixtures and prevent notification delivery to external services.
