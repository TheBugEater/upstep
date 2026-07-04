type Item = {
  title: string;
  type: "FEATURE" | "BUG" | "GENERAL";
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  upvotes: number;
  age: string;
};

const ITEMS: Item[] = [
  { title: "Add dark mode to the dashboard", type: "FEATURE", status: "IN_PROGRESS", upvotes: 142, age: "2d" },
  { title: "Export feedback to CSV", type: "FEATURE", status: "OPEN", upvotes: 98, age: "4d" },
  { title: "Slack notifications for new feedback", type: "FEATURE", status: "OPEN", upvotes: 76, age: "1w" },
  { title: "Login button overlaps on iPhone SE", type: "BUG", status: "DONE", upvotes: 37, age: "1w" },
  { title: "Let users edit their submission", type: "GENERAL", status: "OPEN", upvotes: 21, age: "2w" },
];

const TYPE_STYLES: Record<Item["type"], string> = {
  FEATURE: "bg-info/10 text-info border-info/25",
  BUG: "bg-danger/10 text-danger border-danger/25",
  GENERAL: "bg-surface text-muted border-line",
};

const STATUS_STYLES: Record<Item["status"], string> = {
  OPEN: "bg-warning/10 text-warning border-warning/25",
  IN_PROGRESS: "bg-info/10 text-info border-info/25",
  DONE: "bg-success/10 text-success border-success/25",
};

export function BoardPreview() {
  return (
    <div className="rounded-2xl border border-line bg-card shadow-lift overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-clay/10 text-clay flex items-center justify-center text-sm">▤</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Mobile App</div>
            <div className="text-[11px] text-faint">Feedback board</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success/100" />
          Live
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-line">
        <Chip active>All</Chip>
        <Chip>Features</Chip>
        <Chip>Bugs</Chip>
        <span className="ml-auto text-[11px] text-faint">Sorted by votes ▾</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-line">
        {ITEMS.map((it) => (
          <div key={it.title} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-surface/50 transition">
            {/* Upvote */}
            <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl border border-line bg-surface/60 py-1.5">
              <span className="text-clay text-[11px] leading-none">▲</span>
              <span className="text-sm font-semibold text-ink leading-tight">{it.upvotes}</span>
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{it.title}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge className={TYPE_STYLES[it.type]}>{it.type}</Badge>
                <Badge className={STATUS_STYLES[it.status]}>{it.status.replace("_", " ")}</Badge>
                <span className="text-[11px] text-faint">· {it.age}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
        active ? "bg-primary text-primary-fg" : "bg-surface text-muted border border-line"
      }`}
    >
      {children}
    </span>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${className}`}>
      {children}
    </span>
  );
}
