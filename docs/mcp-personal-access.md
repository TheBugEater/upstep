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
