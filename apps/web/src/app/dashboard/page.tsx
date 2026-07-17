import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
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

  const openTotal = Object.values(countMap).reduce((sum, counts) => sum + (counts.OPEN ?? 0), 0);
  const activeTotal = Object.values(countMap).reduce((sum, counts) => sum + (counts.IN_PROGRESS ?? 0), 0);
  const pendingTotal = Object.values(countMap).reduce((sum, counts) => sum + (counts.PENDING ?? 0), 0);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-10">
      <div className="flex flex-wrap items-start justify-between gap-5 animate-fade-up">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Workspace overview
          </div>
          <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">Good to see you.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">A live view of what your users are asking for and what your team is shipping.</p>
        </div>
        {atProjectLimit ? (
          <Link href="/dashboard/billing" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg shadow-soft transition hover:opacity-90">Upgrade to add a project <span aria-hidden>→</span></Link>
        ) : (
          <Link href="/dashboard/projects/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-clay px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-clay-hover"><span className="text-lg leading-none">+</span> New project</Link>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Total feedback" value={totalFeedback} detail={`Across ${projects.length} project${projects.length === 1 ? "" : "s"}`} tone="clay" icon="↗" />
        <Metric label="Open requests" value={openTotal} detail="Waiting for triage" tone="warning" icon="◌" />
        <Metric label="In progress" value={activeTotal} detail="Being worked on" tone="info" icon="→" />
        <Metric label="Community votes" value={totalVotes} detail={pendingTotal ? `${pendingTotal} pending review` : "All caught up"} tone="success" icon="▲" />
      </div>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-ink">Your projects</h2>
              <p className="mt-0.5 text-xs text-faint">Switch projects or jump straight into a workflow.</p>
            </div>
            <Link href="/dashboard/billing" className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted hover:border-clay/30 hover:text-clay">{plan.name} · {projects.length}{isUnlimited(plan.projectLimit) ? "" : `/${formatLimit(plan.projectLimit)}`}</Link>
          </div>

          {projects.length === 0 ? <EmptyState /> : (
            <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
              <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(260px,1fr)_110px_132px] gap-4 border-b border-line bg-surface/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-faint md:grid">
                <span>Project</span><span>Progress</span><span>Votes</span><span className="text-right">Quick actions</span>
              </div>
              {projects.map((p, i) => {
              const counts = countMap[p.id] ?? {};
              const openCount = counts["OPEN"] ?? 0;
              const inProgressCount = counts["IN_PROGRESS"] ?? 0;
              const doneCount = counts["DONE"] ?? 0;
              const pendingCount = counts["PENDING"] ?? 0;
              const total = p._count.feedback;
              const votes = votesMap[p.id] ?? 0;
              const barTotal = Math.max(openCount + inProgressCount + doneCount, 1);

                return <div key={p.id} className="group relative grid gap-4 border-b border-line px-4 py-4 last:border-0 hover:bg-surface/45 md:grid-cols-[minmax(220px,1.5fr)_minmax(260px,1fr)_110px_132px] md:items-center md:px-5 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <Link href={`/dashboard/projects/${p.id}`} className="absolute inset-0" aria-label={`Open ${p.name}`} />
                  <div className="relative pointer-events-none flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-clay/15 bg-clay/10 font-serif text-lg text-clay">{p.name[0]?.toUpperCase() ?? "P"}</span>
                    <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-ink">{p.name}</span>{pendingCount > 0 && <span className="rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-bold text-white">{pendingCount} new</span>}</span><span className="mt-0.5 block text-[11px] text-faint">{total} feedback · Updated {new Date(p.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
                  </div>
                  <div className="pointer-events-none relative">
                    <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-surface"><span className="bg-warning" style={{ width: `${(openCount / barTotal) * 100}%` }} /><span className="bg-info" style={{ width: `${(inProgressCount / barTotal) * 100}%` }} /><span className="bg-success" style={{ width: `${(doneCount / barTotal) * 100}%` }} /></div>
                    <div className="flex gap-3"><Stat dot="bg-warning" n={openCount} label="open" /><Stat dot="bg-info" n={inProgressCount} label="active" /><Stat dot="bg-success" n={doneCount} label="done" /></div>
                  </div>
                  <div className="pointer-events-none relative flex items-center gap-2 text-sm font-bold text-ink"><span className="text-xs text-clay">▲</span>{votes.toLocaleString()}</div>
                  <div className="relative z-10 flex justify-end gap-1.5"><Link href={`/dashboard/projects/${p.id}?tab=mcp`} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted hover:border-clay/30 hover:text-clay">✦ MCP</Link><Link href={`/dashboard/projects/${p.id}`} className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-fg">Open →</Link></div>
                </div>;
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Workspace health</span><span className="flex items-center gap-1.5 text-[10px] font-semibold text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Live</span></div>
            <p className="mt-4 font-serif text-2xl text-ink">{pendingTotal ? `${pendingTotal} item${pendingTotal === 1 ? "" : "s"} need review` : "Inbox zero"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{pendingTotal ? "Review incoming feedback before it reaches your public boards." : "Every incoming item has been reviewed. Nice work."}</p>
            {pendingTotal > 0 && projects.find((p) => (countMap[p.id]?.PENDING ?? 0) > 0) && <Link href={`/dashboard/projects/${projects.find((p) => (countMap[p.id]?.PENDING ?? 0) > 0)!.id}?tab=pending`} className="mt-4 inline-flex text-xs font-bold text-clay hover:text-clay-hover">Review feedback →</Link>}
          </div>
          <div className="rounded-2xl bg-primary p-5 text-primary-fg shadow-soft">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-50">Agent workflow</span>
            <p className="mt-3 text-base font-bold">Connect your coding agent</p>
            <p className="mt-1 text-xs leading-relaxed opacity-65">Let Claude, Codex, or Cursor triage feedback and close the loop as you ship.</p>
            {projects[0] ? <Link href={`/dashboard/projects/${projects[0].id}?tab=mcp`} className="mt-4 inline-flex rounded-lg bg-clay px-3 py-2 text-xs font-bold text-white">Set up MCP →</Link> : <Link href="/dashboard/projects/new" className="mt-4 inline-flex rounded-lg bg-clay px-3 py-2 text-xs font-bold text-white">Create a project →</Link>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: "clay" | "warning" | "info" | "success"; icon: string }) {
  const tones = { clay: "bg-clay/10 text-clay", warning: "bg-warning/10 text-warning", info: "bg-info/10 text-info", success: "bg-success/10 text-success" };
  return <div className="rounded-2xl border border-line bg-card p-4 shadow-soft sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-muted">{label}</p><p className="mt-2 font-serif text-3xl tracking-tight text-ink sm:text-4xl">{value.toLocaleString()}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${tones[tone]}`}>{icon}</span></div><p className="mt-3 truncate text-[10px] font-medium text-faint">{detail}</p></div>;
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
      <p className="text-ink font-medium">Create your first project</p>
      <p className="text-sm text-muted mt-1 mb-6">You’ll get an API key and a ready-to-use feedback board.</p>
      <Link
        href="/dashboard/projects/new"
        className="inline-flex items-center gap-2 bg-clay text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-clay-hover transition"
      >
        Create an app →
      </Link>
    </div>
  );
}
