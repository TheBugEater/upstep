import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SetupGuideButton } from "@/components/dashboard/SetupGuide";
import { ProjectTabs } from "@/components/dashboard/ProjectTabs";

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

  const [listFeedback, boardFeedback, pendingFeedback, completedFeedback, openCount, inProgressCount, pendingCount] = await Promise.all([
    db.feedback.findMany({
      where: { projectId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } },
      orderBy: { upvotes: "desc" },
      take: 100,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: "DONE" },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.feedback.count({ where: { projectId: id, status: "OPEN" } }),
    db.feedback.count({ where: { projectId: id, status: "IN_PROGRESS" } }),
    db.feedback.count({ where: { projectId: id, status: "PENDING" } }),
  ]);

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  const { plan: ownerPlan, ...ownerRest } = project.owner;

  const teamMembers = [
    ...(project.owner ? [{ ...ownerRest, role: "OWNER" as const }] : []),
    ...project.members.map((m) => ({ ...m.user, role: "MEMBER" as const })),
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardHeader email={session.user.email} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <Link
          href="/dashboard"
          className="text-xs text-muted hover:text-ink transition inline-flex items-center gap-1 mb-3"
        >
          ← All projects
        </Link>

        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="font-serif text-2xl sm:text-3xl tracking-tight text-ink min-w-0 truncate">
            {project.name}
          </h1>
          {isOwner && <SetupGuideButton apiKey={project.apiKey} baseUrl={baseUrl} />}
        </div>

        <ProjectTabs
          projectId={id}
          apiKey={project.apiKey}
          moderationEnabled={project.moderationEnabled}
          isOwner={isOwner}
          ownerPlan={ownerPlan}
          teamMembers={teamMembers}
          listFeedback={listFeedback as never}
          boardFeedback={boardFeedback as never}
          pendingFeedback={pendingFeedback as never}
          completedFeedback={completedFeedback as never}
          pendingCount={pendingCount}
          activeCount={openCount + inProgressCount}
        />
      </div>
    </div>
  );
}
