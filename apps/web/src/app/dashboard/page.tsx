import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { getPlan, formatLimit, isUnlimited } from "@/lib/plans";
import { createProjectWithDefaults } from "@/lib/projects";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ newProject?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Visitors who typed an app name into the landing page CTA land here right
  // after their first OAuth sign-in. Turn that into their first project so
  // signing up feels like a continuation, not a fresh start. Guarded to
  // first-time accounts only so reloading this URL can't spawn duplicates.
  const { newProject } = await searchParams;
  if (newProject?.trim()) {
    const existingCount = await db.project.count({ where: { ownerId: session.user.id } });
    if (existingCount === 0) {
      const project = await createProjectWithDefaults(newProject.trim().slice(0, 80), session.user.id);
      redirect(`/dashboard/projects/${project.id}`);
    }
    redirect("/dashboard");
  }

  const [projects, user] = await Promise.all([
    db.project.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { feedback: true } } },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
  ]);

  // Aggregate per-status counts and vote totals across all projects at once
  const projectIds = projects.map((p) => p.id);
  const [feedbackCounts, voteTotals] = projectIds.length
    ? await Promise.all([
        db.feedback.groupBy({
          by: ["projectId", "status"],
          _count: { id: true },
          where: { projectId: { in: projectIds } },
        }),
        db.feedback.groupBy({
          by: ["projectId"],
          _sum: { upvotes: true },
          where: { projectId: { in: projectIds } },
        }),
      ])
    : [[], []];

  type CountMap = Record<string, Record<string, number>>;
  const countMap: CountMap = {};
  for (const row of feedbackCounts) {
    if (!countMap[row.projectId]) countMap[row.projectId] = {};
    countMap[row.projectId]![row.status] = row._count.id;
  }
  const votesMap: Record<string, number> = {};
  for (const row of voteTotals) votesMap[row.projectId] = row._sum.upvotes ?? 0;

  const totalFeedback = projects.reduce((n, p) => n + p._count.feedback, 0);
  const totalVotes = Object.values(votesMap).reduce((n, v) => n + v, 0);
  const plan = getPlan(user?.plan);
  const atProjectLimit = projects.length >= plan.projectLimit;

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardHeader email={session.user.email} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Heading */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8 animate-fade-up">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-3xl tracking-tight text-ink">Apps</h1>
              <Link
                href="/dashboard/billing"
                className="text-[11px] font-semibold uppercase tracking-wide text-clay bg-clay-tint border border-clay/20 rounded-full px-2.5 py-1 hover:bg-clay-tint2 transition"
              >
                {plan.name} plan
              </Link>
            </div>
            <p className="text-sm text-muted mt-1">
              {projects.length}
              {isUnlimited(plan.projectLimit) ? "" : ` / ${formatLimit(plan.projectLimit)}`} app
              {projects.length === 1 ? "" : "s"} · {totalFeedback} feedback item
              {totalFeedback === 1 ? "" : "s"} · {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            </p>
          </div>
          {atProjectLimit ? (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 bg-primary text-primary-fg rounded-full px-5 py-2.5 text-sm font-medium hover:bg-primary/85 transition shadow-soft"
            >
              Upgrade to add more →
            </Link>
          ) : (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition shadow-soft"
            >
              <span aria-hidden className="text-base leading-none">+</span>
              New app
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {projects.map((p, i) => {
              const counts = countMap[p.id] ?? {};
              const openCount = counts["OPEN"] ?? 0;
              const inProgressCount = counts["IN_PROGRESS"] ?? 0;
              const doneCount = counts["DONE"] ?? 0;
              const pendingCount = counts["PENDING"] ?? 0;
              const total = p._count.feedback;
              const votes = votesMap[p.id] ?? 0;
              const barTotal = Math.max(openCount + inProgressCount + doneCount, 1);

              return (
                <div
                  key={p.id}
                  className="group relative rounded-2xl border border-line bg-card p-5 shadow-soft hover:shadow-lift hover:-translate-y-1 hover:border-clay/30 transition-all duration-300 ease-fluid animate-fade-up overflow-hidden"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  {/* Whole card opens the app (stretched link, under the chips) */}
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    aria-label={`Open ${p.name}`}
                    className="absolute inset-0 z-0"
                  />
                  {/* Brand wash on hover */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-clay/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Header row */}
                  <div className="pointer-events-none relative flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-clay/20 to-clay/5 text-clay border border-clay/15 flex items-center justify-center font-serif text-lg shrink-0 group-hover:scale-105 transition-transform duration-300 ease-spring">
                      {p.name[0]?.toUpperCase() ?? "A"}
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
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-clay/10 text-clay border border-clay/30 shrink-0">
                        {pendingCount} pending
                      </span>
                    )}
                    <span className="text-muted text-sm opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shrink-0">
                      →
                    </span>
                  </div>

                  {/* Status distribution */}
                  <div className="pointer-events-none relative flex h-1.5 rounded-full overflow-hidden bg-surface mb-3.5">
                    <span className="bg-warning/70 transition-all duration-500" style={{ width: `${(openCount / barTotal) * 100}%` }} />
                    <span className="bg-info/70 transition-all duration-500" style={{ width: `${(inProgressCount / barTotal) * 100}%` }} />
                    <span className="bg-success/70 transition-all duration-500" style={{ width: `${(doneCount / barTotal) * 100}%` }} />
                  </div>

                  {/* Stats row */}
                  <div className="pointer-events-none relative flex items-center gap-4">
                    <Stat dot="bg-warning" n={openCount} label="open" />
                    <Stat dot="bg-info" n={inProgressCount} label="active" />
                    <Stat dot="bg-success" n={doneCount} label="done" />
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-faint">
                      <span className="text-clay text-[10px]">▲</span>
                      {votes} · {total} total
                    </span>
                  </div>

                  {/* Quick actions */}
                  <div className="relative z-10 mt-4 pt-3.5 border-t border-line flex items-center gap-2">
                    <Link
                      href={`/dashboard/projects/${p.id}?tab=integrations`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-clay border border-line hover:border-clay/30 rounded-full px-2.5 py-1 transition"
                      title="Connect Claude Code, Cursor, or any MCP client"
                    >
                      <span className="text-clay">✦</span>
                      Connect AI
                    </Link>
                    <Link
                      href={`/dashboard/projects/${p.id}?tab=settings`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink border border-line hover:border-line-strong rounded-full px-2.5 py-1 transition"
                    >
                      API key
                    </Link>
                    <span className="pointer-events-none ml-auto text-[10px] text-faint">MCP ready</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
      <span className="text-sm font-semibold text-ink">{n}</span>
      <span className="text-xs text-faint">{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 py-20 text-center animate-fade-up">
      <div className="w-12 h-12 rounded-2xl bg-clay/10 text-clay flex items-center justify-center text-xl mx-auto mb-4">
        +
      </div>
      <p className="text-ink font-medium">No apps yet</p>
      <p className="text-sm text-muted mt-1 mb-6">Create your first app to get an API key.</p>
      <Link
        href="/dashboard/projects/new"
        className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition"
      >
        Create an app →
      </Link>
    </div>
  );
}
