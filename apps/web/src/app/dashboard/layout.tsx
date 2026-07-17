import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { UpstepWidget } from "@/components/UpstepWidget";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");

  const [user, projects] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, plan: true } }),
    db.project.findMany({
      where: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        _count: { select: { feedback: true } },
      },
    }),
  ]);

  const feedbackCounts = projects.length
    ? await db.feedback.groupBy({
        by: ["projectId", "status"],
        where: { projectId: { in: projects.map((project) => project.id) } },
        _count: { id: true },
      })
    : [];

  const counts = new Map<string, Record<string, number>>();
  for (const row of feedbackCounts) {
    const projectCounts = counts.get(row.projectId) ?? {};
    projectCounts[row.status] = row._count.id;
    counts.set(row.projectId, projectCounts);
  }

  return (
    <DashboardShell
      email={session.user.email}
      name={user?.name}
      plan={user?.plan ?? "FREE"}
      projects={projects.map((project) => {
        const projectCounts = counts.get(project.id) ?? {};
        return {
          id: project.id,
          name: project.name,
          feedbackCount: project._count.feedback,
          activeCount: (projectCounts.OPEN ?? 0) + (projectCounts.IN_PROGRESS ?? 0),
          completedCount: projectCounts.DONE ?? 0,
          pendingCount: projectCounts.PENDING ?? 0,
        };
      })}
    >
      {children}
      <UpstepWidget {...(session?.user?.id ? { userId: session.user.id } : {})} />
    </DashboardShell>
  );
}
