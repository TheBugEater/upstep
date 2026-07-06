import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { FeedbackType, Label } from "@upstep/types";
import type { BoardFilters } from "@/types/dashboard";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { TypePill } from "@/components/workspace/ui";

// relativeDate from components/workspace/ui.tsx can't be called directly here -
// it's a plain function export from a "use client" module, and only its
// components (like TypePill) may cross the server/client boundary as JSX.
function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  params: Promise<{ slug: string }>;
}

async function getData(slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    include: { owner: { select: { plan: true } } },
  });
  if (!project) return null;

  const board = await db.board.findFirst({
    where: { projectId: project.id, isPublic: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: { status: true },
      },
    },
  });
  if (!board) return null;

  const statusIds = board.columns.map((c) => c.statusId);
  const items = await db.feedback.findMany({
    where: {
      projectId: project.id,
      internal: false,
      statusId: { in: statusIds },
    },
    orderBy: { upvotes: "desc" },
    include: {
      labels: { select: { id: true, name: true, color: true } },
    },
  });

  // Non-default boards apply their saved filters on top, same as the
  // dashboard's `boardFiltered` logic (ProjectWorkspace.tsx).
  const filters = !board.isDefault ? (board.filters as BoardFilters | null) : null;
  const filtered = filters
    ? items.filter((item) => {
        if (filters.labelIds?.length && !item.labels.some((l) => filters.labelIds!.includes(l.id))) return false;
        if (filters.types?.length && !filters.types.includes(item.type)) return false;
        if (filters.createdAfter && item.createdAt < new Date(filters.createdAfter)) return false;
        if (filters.createdBefore && item.createdAt > new Date(filters.createdBefore)) return false;
        return true;
      })
    : items;

  const doneStatusIds = new Set(board.columns.filter((c) => c.status.isDone).map((c) => c.statusId));
  const shipped = filtered
    .filter((f) => f.statusId && doneStatusIds.has(f.statusId))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const showBranding = getPlan(project.owner.plan).branding;

  return { project, board, items: filtered, shipped, showBranding };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({ where: { slug }, select: { name: true } });
  return { title: project ? `${project.name} Roadmap` : "Roadmap" };
}

export default async function PublicRoadmapPage({ params }: Props) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { project, board, items, shipped, showBranding } = data;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight text-ink mb-1">{project.name}</h1>
        <p className="text-sm text-muted mb-8">Roadmap &amp; changelog</p>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {board.columns.map((col) => {
            const colItems = items.filter((f) => f.statusId === col.statusId);
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72 rounded-2xl border border-line bg-surface/40 self-start"
              >
                <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: col.status.color }}
                  />
                  <span className="text-sm font-semibold text-ink truncate">{col.status.name}</span>
                  <span className="ml-auto text-xs font-medium text-faint bg-card border border-line rounded-full px-2 py-0.5 shrink-0">
                    {colItems.length}
                  </span>
                </div>

                <div className="p-2.5 space-y-2.5 min-h-[120px] max-h-[65vh] overflow-y-auto">
                  {colItems.length === 0 ? (
                    <div className="text-center text-xs py-8 text-faint">Nothing here</div>
                  ) : (
                    colItems.map((f) => (
                      <article
                        key={f.id}
                        className="bg-card border border-line rounded-xl p-3 shadow-soft"
                      >
                        <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">
                          {f.title ?? f.content}
                        </p>
                        {f.title && (
                          <p className="text-xs text-muted mt-1 line-clamp-2 leading-snug">{f.content}</p>
                        )}

                        {f.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {f.labels.map((l: Pick<Label, "id" | "name" | "color">) => (
                              <span
                                key={l.id}
                                className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                style={{ backgroundColor: l.color }}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="inline-flex items-center gap-1 text-clay text-xs font-semibold">
                            <span className="text-[10px]">▲</span>
                            {f.upvotes}
                          </span>
                          <TypePill type={f.type as FeedbackType} />
                          <span className="ml-auto text-[10px] text-faint">{formatDate(f.createdAt)}</span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12">
          <h2 className="font-serif text-xl text-ink mb-4">Shipped</h2>
          {shipped.length === 0 ? (
            <p className="text-sm text-faint">Nothing shipped yet.</p>
          ) : (
            <ul className="space-y-3">
              {shipped.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-line bg-card p-4 flex items-start gap-3"
                >
                  <span className="text-success text-sm mt-0.5">✓</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink leading-snug">{f.title ?? f.content}</p>
                    {f.title && <p className="text-xs text-muted mt-1 leading-snug">{f.content}</p>}
                  </div>
                  <span className="text-[11px] text-faint shrink-0">{formatDate(f.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showBranding && (
        <a
          href="https://upstep.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-3 border-t border-line text-[11px] text-faint hover:text-muted transition"
        >
          Powered by <strong className="font-bold">Upstep.dev</strong>
        </a>
      )}
    </div>
  );
}
