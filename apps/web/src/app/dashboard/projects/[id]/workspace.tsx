import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSiteUrl } from "@/lib/site-url";
import { redirect, notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";

/** Loads everything the project workspace needs. The board page and each
 *  task's own page share it, so a task page has the same live actions. */
export async function renderProjectWorkspace({ id, issue, taskPageId }: { id: string; issue?: string | undefined; taskPageId?: string | undefined }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Allow access to both the project owner and invited members.
  const project = await db.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, plan: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) notFound();

  const isOwner = project.ownerId === session.user.id;
  const isMember = project.members.some((m) => m.userId === session.user!.id);
  if (!isOwner && !isMember) notFound();
  const canManage = isOwner || project.members.some((m) => m.userId === session.user!.id && m.role === "ADMIN");

  const include = {
    labels: { select: { id: true, name: true, color: true } },
    boardStatus: { select: { id: true, name: true, color: true, order: true, isDone: true } },
  };

  const [boardFeedback, pendingFeedback, boards, statuses, projectLabels, assignedFeedback] = await Promise.all([
    db.feedback.findMany({
      where: { projectId: id, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } },
      orderBy: { upvotes: "desc" },
      take: 300,
      include,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include,
    }),
    db.board.findMany({
      where: { projectId: id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        columns: {
          orderBy: { order: "asc" },
          include: { status: true },
        },
      },
    }),
    db.status.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
    }),
    db.label.findMany({
      where: { projectId: id },
      orderBy: { name: "asc" },
    }),
    db.feedback.findMany({ where: { projectId: id, assigneeId: session.user.id, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } }, orderBy: { updatedAt: "desc" }, take: 300, include }),
  ]);
  const loaded = new Set(boardFeedback.map((f) => f.id));
  boardFeedback.push(...assignedFeedback.filter((f) => !loaded.has(f.id)));

  // Chat links must open the exact issue, even if it falls outside the board's
  // initial result limit. Keep the lookup scoped to the authorized project.
  if (typeof issue === "string" && !boardFeedback.some((f) => f.id === issue) && !pendingFeedback.some((f) => f.id === issue)) {
    const linked = await db.feedback.findFirst({ where: { id: issue, projectId: id }, include });
    if (linked?.status === "PENDING") pendingFeedback.push(linked);
    else if (linked) boardFeedback.push(linked);
  }

  const baseUrl = getSiteUrl();

  const { plan: ownerPlan, ...ownerRest } = project.owner;

  const teamMembers = [
    ...(project.owner ? [{ ...ownerRest, role: "OWNER" as const }] : []),
    ...project.members.map((m) => ({ ...m.user, role: m.role === "ADMIN" ? "ADMIN" as const : "MEMBER" as const })),
  ];

  return (
    <ProjectWorkspace
          projectId={id}
          projectSlug={project.slug}
          apiKey={project.apiKey}
          baseUrl={baseUrl}
          mcpConfigured={!!await db.mcpCredential.count({ where: { projectId: id, userId: session.user.id, keyHash: { not: null }, revokedAt: null } })}
          moderationEnabled={project.moderationEnabled}
          isOwner={isOwner}
          canManage={canManage}
          currentUserId={session.user.id}
          ownerPlan={ownerPlan}
          teamMembers={teamMembers}
          initialItems={boardFeedback as never}
          initialPending={pendingFeedback as never}
          initialBoards={boards as never}
          initialStatuses={statuses as never}
          initialLabels={projectLabels as never}
          taskPageId={taskPageId}
    />
  );
}
