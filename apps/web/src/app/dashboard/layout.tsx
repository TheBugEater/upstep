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
        feedback: { where: { status: "PENDING" }, select: { id: true }, take: 100 },
      },
    }),
  ]);

  return (
    <DashboardShell
      email={session.user.email}
      name={user?.name}
      plan={user?.plan ?? "FREE"}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        feedbackCount: project._count.feedback,
        pendingCount: project.feedback.length,
      }))}
    >
      {children}
      <UpstepWidget {...(session?.user?.id ? { userId: session.user.id } : {})} />
    </DashboardShell>
  );
}
