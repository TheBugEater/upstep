import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  await searchParams; // consumed to satisfy Next.js dynamic rendering

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

  const include = {
    labels: { select: { id: true, name: true, color: true } },
    boardStatus: { select: { id: true, name: true, color: true, order: true, isDone: true } },
  };

  const [boardFeedback, pendingFeedback, boards, statuses, projectLabels] = await Promise.all([
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
  ]);

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  const { plan: ownerPlan, ...ownerRest } = project.owner;

  const teamMembers = [
    ...(project.owner ? [{ ...ownerRest, role: "OWNER" as const }] : []),
    ...project.members.map((m) => ({ ...m.user, role: "MEMBER" as const })),
  ];

  return (
    <ProjectWorkspace
          projectId={id}
          projectSlug={project.slug}
          apiKey={project.apiKey}
          baseUrl={baseUrl}
          moderationEnabled={project.moderationEnabled}
          isOwner={isOwner}
          ownerPlan={ownerPlan}
          teamMembers={teamMembers}
          initialItems={boardFeedback as never}
          initialPending={pendingFeedback as never}
          initialBoards={boards as never}
          initialStatuses={statuses as never}
          initialLabels={projectLabels as never}
    />
  );
}
