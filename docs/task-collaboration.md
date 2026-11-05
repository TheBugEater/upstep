# Task collaboration

Tasks support one assignee from the project's current team (including its owner).
Anyone on the project can assign, reassign, unassign, or claim a task using
**Assign to me**. An invite must be accepted before that person is eligible.
Removing a teammate unassigns their tasks and preserves their comment history.
Assignment and member removal use serializable transactions to prevent a racing
assignment from pointing to a removed member.

Teammates open the workspace in **My tasks** by default. The owner opens
**All tasks**. The assignment selector also supports unassigned work and each
teammate's tasks; it applies to board and list views. The main board's configured
columns remain available in every view. Choosing **All tasks** displays other
people's and unassigned issues. New tasks created from My tasks default to the
current user, and the new-task dialog can choose anyone else. Personal assignments
are loaded separately so other people's highly voted issues cannot crowd them
out of the board's initial result limit.

The task drawer contains a chronological comment conversation. Each post shows
its author's name, initials and timestamp, and replies retain a reference to the
comment they answer. Comments refresh while the drawer is open. Multiline input
supports Ctrl/Command+Enter to post. Author identity comes from the authenticated
account on the server; request bodies cannot supply another author. Earlier
comments retain their saved display names because their original account identity
cannot be reliably inferred. MCP comments continue to use their provided author
name or **UpStep Team**.

Existing public feedback comments continue to appear in the SDK. SDK source now
shows author names in place of the generic Developer badge; this source change
ships to external apps when they upgrade to a subsequent SDK package release.
Private tasks are excluded from the SDK detail endpoint, and public responses
omit assignment and account identity fields. No assignment emails are sent by
this feature.

## Project roles

| Capability | Member | Admin | Owner |
| --- | --- | --- | --- |
| View, create, comment, triage and assign tasks | Yes | Yes | Yes |
| Start discussions in a connected Google Chat space | Yes | Yes | Yes |
| Manage boards, statuses and project settings | No | Yes | Yes |
| Manage integrations and invitations | No | Yes | Yes |
| Remove regular members | No | Yes | Yes |
| Promote/demote admins or remove admins | No | No | Yes |
| Rotate SDK/MCP keys, delete project, manage billing | No | No | Yes |

The owner changes Member/Admin roles under **Project settings → Team**. Role
changes apply to that project only. The owner cannot be demoted by this control,
and admins cannot grant themselves or others additional privileges.

Run `pnpm --filter @upstep/web test` for transport and unit tests. Set
`UPSTEP_INVITATION_TEST_DATABASE_URL` to an isolated local test database (the same
opt-in database used by invitation tests) for collaboration lifecycle tests,
including role escalation, outsider assignment, named replies, member removal and
manual Google Chat discussions. Google Chat sends are mocked in these tests.
