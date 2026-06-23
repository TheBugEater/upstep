import { Logo } from "@/components/Logo";

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-line rounded-lg ${className ?? ""}`} />;
}

export default function BillingLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo href="/dashboard" />
          <Sk className="w-28 h-7 rounded-full" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Sk className="w-24 h-4 rounded mb-6" />
        <Sk className="w-48 h-9 rounded-lg mb-1" />
        <Sk className="w-64 h-4 rounded mb-8" />

        {/* Stat cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-5 shadow-soft space-y-2">
              <Sk className="w-24 h-3 rounded" />
              <Sk className="w-20 h-8 rounded-lg" />
              <Sk className="w-full h-1.5 rounded-full" />
            </div>
          ))}
        </div>

        {/* Plan grid header */}
        <div className="flex items-center justify-between mb-5">
          <Sk className="w-16 h-7 rounded-lg" />
          <Sk className="w-36 h-8 rounded-lg" />
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-line bg-card p-7 shadow-soft space-y-4">
              <Sk className="w-20 h-5 rounded" />
              <Sk className="w-24 h-9 rounded-lg" />
              <div className="space-y-2.5 pt-1">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Sk key={j} className="w-full h-4 rounded" />
                ))}
              </div>
              <Sk className="w-full h-10 rounded-xl mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
