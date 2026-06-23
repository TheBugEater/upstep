import { Logo } from "@/components/Logo";

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-line rounded-lg ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo href="/dashboard" />
          <Sk className="w-28 h-7 rounded-full" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Sk className="w-28 h-8 rounded-lg" />
              <Sk className="w-20 h-5 rounded-full" />
            </div>
            <Sk className="w-40 h-4 rounded" />
          </div>
          <Sk className="w-32 h-9 rounded-full" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-5 shadow-soft space-y-3">
              <div className="flex items-start justify-between">
                <Sk className="w-32 h-5 rounded" />
                <Sk className="w-14 h-4 rounded-full" />
              </div>
              <Sk className="w-20 h-4 rounded" />
              <div className="pt-2 border-t border-line">
                <Sk className="w-24 h-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
