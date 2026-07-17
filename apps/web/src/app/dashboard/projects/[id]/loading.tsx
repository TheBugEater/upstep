function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-line rounded-lg ${className ?? ""}`} />;
}

export default function ProjectLoading() {
  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
        <div className="mb-5 flex items-center justify-between"><div className="space-y-2"><Sk className="h-6 w-28" /><Sk className="h-3 w-40" /></div><Sk className="h-9 w-24" /></div>
        <div className="flex gap-2 mb-4">
          <Sk className="w-36 h-8 rounded-xl" />
          <Sk className="w-44 h-8 rounded-xl" />
          <Sk className="w-28 h-8 rounded-xl" />
          <Sk className="w-28 h-8 rounded-xl" />
        </div>

        {/* Feedback rows */}
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card px-5 py-4 flex items-center gap-4 shadow-soft">
              <Sk className="w-11 h-11 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Sk className={`h-4 rounded ${i % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
                <Sk className="w-1/3 h-3 rounded" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Sk className="w-14 h-5 rounded-full hidden sm:block" />
                <Sk className="w-16 h-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
