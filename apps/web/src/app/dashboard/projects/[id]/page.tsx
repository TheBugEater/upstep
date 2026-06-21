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
  searchParams: Promise<{ type?: string; status?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { type, sort } = await searchParams;

  // Allow access to both the project owner and invited members.
  const project = await db.project.findUnique({
    where: { id },
    include: {
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

  const [listFeedback, boardFeedback, pendingFeedback, completedFeedback, stats] = await Promise.all([
    db.feedback.findMany({
      where: {
        projectId: id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(type ? { type: type as never } : {}),
      },
      orderBy: sort === "votes" ? { upvotes: "desc" } : { createdAt: "desc" },
      take: 100,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } },
      orderBy: { upvotes: "desc" },
      take: 300,
    }),
    db.feedback.findMany({
      where: { projectId: id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.feedback.findMany({
      where: {
        projectId: id,
        status: "DONE",
        ...(type ? { type: type as never } : {}),
      },
      orderBy: sort === "votes" ? { upvotes: "desc" } : { createdAt: "desc" },
      take: 100,
    }),
    Promise.all([
      db.feedback.count({ where: { projectId: id, status: { not: "PENDING" } } }),
      db.feedback.count({ where: { projectId: id, status: "OPEN" } }),
      db.feedback.count({ where: { projectId: id, status: "IN_PROGRESS" } }),
      db.feedback.count({ where: { projectId: id, status: "PENDING" } }),
    ]),
  ]);

  const [total, open, inProgress, pendingCount] = stats;
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  // Shape members for SettingsTab (owner first, then members by join date)
  const ownerUser = await db.user.findUnique({
    where: { id: project.ownerId },
    select: { id: true, name: true, email: true },
  });
  const teamMembers = [
    ...(ownerUser ? [{ ...ownerUser, role: "OWNER" as const }] : []),
    ...project.members.map((m) => ({ ...m.user, role: "MEMBER" as const })),
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardHeader email={session.user.email} />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-ink transition inline-flex items-center gap-1.5 mb-5"
        >
          ← All projects
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-ink">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted">
              <span>
                <span className="font-semibold text-ink">{total}</span> items
              </span>
              <span className="text-line">·</span>
              <span>
                <span className="font-semibold text-clay">{open}</span> open
              </span>
              <span className="text-line">·</span>
              <span>
                <span className="font-semibold text-ink">{inProgress}</span> in progress
              </span>
              {pendingCount > 0 && (
                <>
                  <span className="text-line">·</span>
                  <span>
                    <span className="font-semibold text-orange-500">{pendingCount}</span> pending review
                  </span>
                </>
              )}
            </div>
          </div>
          {isOwner && <SetupGuideButton apiKey={project.apiKey} baseUrl={baseUrl} />}
        </div>

        <ProjectTabs
          projectId={id}
          apiKey={project.apiKey}
          moderationEnabled={project.moderationEnabled}
          isOwner={isOwner}
          teamMembers={teamMembers}
          listFeedback={listFeedback as never}
          boardFeedback={boardFeedback as never}
          pendingFeedback={pendingFeedback as never}
          completedFeedback={completedFeedback as never}
          pendingCount={pendingCount}
          currentType={type ?? undefined}
          currentSort={sort ?? undefined}
        />
      </div>
    </div>
  );
}
