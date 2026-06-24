import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { getPlan, formatLimit, isUnlimited } from "@/lib/plans";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [projects, user] = await Promise.all([
    db.project.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { feedback: true } } },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
  ]);

  // Single aggregated query for per-status counts across all projects
  const feedbackCounts = projects.length > 0
    ? await db.feedback.groupBy({
        by: ["projectId", "status"],
        _count: { id: true },
        where: { projectId: { in: projects.map((p) => p.id) } },
      })
    : [];

  type CountMap = Record<string, Record<string, number>>;
  const countMap: CountMap = {};
  for (const row of feedbackCounts) {
    if (!countMap[row.projectId]) countMap[row.projectId] = {};
    countMap[row.projectId]![row.status] = row._count.id;
  }

  const totalFeedback = projects.reduce((n, p) => n + p._count.feedback, 0);
  const plan = getPlan(user?.plan);
  const atProjectLimit = projects.length >= plan.projectLimit;

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardHeader email={session.user.email} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Heading */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-3xl tracking-tight text-ink">Projects</h1>
              <Link
                href="/dashboard/billing"
                className="text-[11px] font-semibold uppercase tracking-wide text-clay bg-clay-tint border border-clay/20 rounded-full px-2.5 py-1 hover:bg-clay-tint2 transition"
              >
                {plan.name} plan
              </Link>
            </div>
            <p className="text-sm text-muted mt-1">
              {projects.length}
              {isUnlimited(plan.projectLimit) ? "" : ` / ${formatLimit(plan.projectLimit)}`} project
              {projects.length === 1 ? "" : "s"} · {totalFeedback} feedback item
              {totalFeedback === 1 ? "" : "s"}
            </p>
          </div>
          {atProjectLimit ? (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-ink-soft transition shadow-soft"
            >
              Upgrade to add more →
            </Link>
          ) : (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
            >
              <span aria-hidden className="text-base leading-none">+</span>
              New project
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {projects.map((p) => {
              const counts = countMap[p.id] ?? {};
              const openCount = counts["OPEN"] ?? 0;
              const inProgressCount = counts["IN_PROGRESS"] ?? 0;
              const pendingCount = counts["PENDING"] ?? 0;
              const total = p._count.feedback;

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="group rounded-2xl border border-line bg-card p-5 shadow-soft hover:shadow-lift hover:-translate-y-0.5 hover:border-clay/30 transition-all"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-clay/10 text-clay flex items-center justify-center font-serif text-base shrink-0">
                      {p.name[0]?.toUpperCase() ?? "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate leading-snug">{p.name}</p>
                      <p className="text-xs text-faint mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {pendingCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                        {pendingCount} pending
                      </span>
                    )}
                    <span className="text-muted text-sm opacity-0 group-hover:opacity-100 transition shrink-0">
                      →
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 pt-3.5 border-t border-line">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-clay/70 shrink-0" />
                      <span className="text-sm font-semibold text-ink">{openCount}</span>
                      <span className="text-xs text-faint">open</span>
                    </div>
                    {inProgressCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-sm font-semibold text-ink">{inProgressCount}</span>
                        <span className="text-xs text-faint">in progress</span>
                      </div>
                    )}
                    <span className="ml-auto text-xs text-faint">
                      {total} total
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-clay/10 text-clay flex items-center justify-center text-xl mx-auto mb-4">
        +
      </div>
      <p className="text-ink font-medium">No projects yet</p>
      <p className="text-sm text-muted mt-1 mb-6">Create your first project to get an API key.</p>
      <Link
        href="/dashboard/projects/new"
        className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition"
      >
        Create a project →
      </Link>
    </div>
  );
}
