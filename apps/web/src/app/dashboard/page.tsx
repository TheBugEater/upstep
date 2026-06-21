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
          <div className="grid sm:grid-cols-2 gap-4">
            {projects.map((p: typeof projects[number]) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="group rounded-2xl border border-line bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 hover:border-clay/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-clay/10 text-clay flex items-center justify-center font-serif text-lg">
                    {p.name[0]?.toUpperCase() ?? "P"}
                  </div>
                  <span className="text-faint text-sm opacity-0 group-hover:opacity-100 transition">→</span>
                </div>

                <div className="mt-4 font-semibold text-ink">{p.name}</div>
                <div className="mt-1 text-xs text-faint">
                  Created {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </div>

                <div className="mt-5 pt-4 border-t border-line flex items-center justify-between">
                  <span className="text-xs text-muted">Feedback</span>
                  <span className="text-sm font-semibold text-ink">{p._count.feedback}</span>
                </div>
              </Link>
            ))}
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
        ✦
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
