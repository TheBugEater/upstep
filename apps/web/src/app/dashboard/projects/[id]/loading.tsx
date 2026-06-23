import { Logo } from "@/components/Logo";

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-line rounded-lg ${className ?? ""}`} />;
}

export default function ProjectLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo href="/dashboard" />
          <Sk className="w-28 h-7 rounded-full" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <Sk className="w-20 h-3 rounded mb-3" />

        <div className="flex items-center justify-between gap-3 mb-4">
          <Sk className="w-48 h-8 rounded-lg" />
          <Sk className="w-9 h-9 rounded-full" />
        </div>

        {/* Tab bar */}
        <div className="relative mb-4">
          <div className="absolute inset-x-0 bottom-0 border-b border-line" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className={`h-9 rounded-t-lg ${i === 0 ? "w-24" : "w-20"}`} />
            ))}
          </div>
        </div>

        {/* Filter bar */}
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
    </div>
  );
}
