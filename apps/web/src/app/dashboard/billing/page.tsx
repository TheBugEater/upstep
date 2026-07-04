import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { UpgradeSuccessBanner } from "@/components/billing/UpgradeSuccessBanner";
import { CurrencySwitcher } from "@/components/billing/CurrencySwitcher";
import { PLANS, PLAN_ORDER, getPlan, formatLimit, formatPrice, isUnlimited } from "@/lib/plans";
import { detectCurrency } from "@/lib/currency";
import { billingEnabled } from "@/lib/stripe";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { upgraded } = await searchParams;
  const currency = await detectCurrency();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, stripeCustomerId: true },
  });
  const current = getPlan(user?.plan);

  const [projectCount, agg] = await Promise.all([
    db.project.count({ where: { ownerId: session.user.id } }),
    db.feedback.aggregate({
      where: { project: { ownerId: session.user.id } },
      _count: true,
    }),
  ]);
  const feedbackCount = agg._count;

  const enabled = billingEnabled();

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardHeader email={session.user.email} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-ink transition inline-flex items-center gap-1.5 mb-6"
        >
          ← Back to dashboard
        </Link>

        <h1 className="font-serif text-3xl tracking-tight text-ink">Billing &amp; plan</h1>
        <p className="text-sm text-muted mt-1">Manage your subscription and see your usage.</p>

        {upgraded && <UpgradeSuccessBanner plan={current.name} />}

        {!enabled && (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Billing isn&apos;t configured on this server yet. Add your Stripe keys to{" "}
            <code className="font-mono text-xs">.env</code> to enable checkout. Plan limits are still
            enforced.
          </div>
        )}

        {/* Current plan + usage */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
            <div className="text-xs text-muted">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-serif text-2xl text-ink">{current.name}</span>
              {current.id !== "FREE" && (
                <span className="text-xs text-faint">{formatPrice(current.id, currency)}/mo</span>
              )}
            </div>
            {user?.stripeCustomerId && (
              <ManageBillingButton className="mt-3 text-xs font-medium text-clay hover:underline" />
            )}
          </div>

          <UsageCard
            label="Projects"
            used={projectCount}
            limit={current.projectLimit}
          />
          <UsageCard
            label="Feedback items"
            used={feedbackCount}
            limit={current.feedbackLimit}
            note={isUnlimited(current.feedbackLimit) ? "" : "per project cap"}
          />
        </div>

        {/* Plan options */}
        <div className="mt-12 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-serif text-2xl text-ink">Plans</h2>
          <CurrencySwitcher current={currency} />
        </div>
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = plan.id === current.id;
            const currentIndex = PLAN_ORDER.indexOf(current.id);
            const thisIndex = PLAN_ORDER.indexOf(id);
            const isUpgrade = thisIndex > currentIndex;

            return (
              <div
                key={id}
                className={`relative flex flex-col rounded-3xl border bg-card p-7 ${
                  isCurrent ? "border-clay/50 shadow-lift" : "border-line shadow-soft"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-fg text-[11px] font-semibold px-3 py-1 rounded-full">
                    Current plan
                  </span>
                )}

                <h3 className="font-semibold text-ink text-lg">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-serif text-3xl text-ink">{formatPrice(plan.id, currency)}</span>
                  <span className="text-sm text-faint">/ mo</span>
                </div>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm text-ink-soft">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-clay/15 text-clay flex items-center justify-center text-[10px] shrink-0">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="text-center w-full py-3 rounded-xl text-sm font-medium bg-surface text-muted border border-line">
                      Your plan
                    </div>
                  ) : plan.id === "FREE" ? (
                    user?.stripeCustomerId ? (
                      <ManageBillingButton className="block text-center w-full py-3 rounded-xl text-sm font-medium bg-surface border border-line text-ink hover:bg-card transition" />
                    ) : (
                      <div className="text-center w-full py-3 rounded-xl text-sm font-medium bg-surface text-muted border border-line">
                        Free forever
                      </div>
                    )
                  ) : (
                    <CheckoutButton
                      planId={plan.id as "PRO" | "BUSINESS"}
                      currency={currency}
                      label={isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                      className="block text-center w-full py-3 rounded-xl text-sm font-medium bg-clay text-white hover:bg-clay-hover transition shadow-soft"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  note,
}: {
  label: string;
  used: number;
  limit: number;
  note?: string | undefined;
}) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const near = !unlimited && pct >= 80;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-serif text-2xl text-ink">
        {used.toLocaleString()}
        <span className="text-sm text-faint font-sans"> / {formatLimit(limit)}</span>
      </div>
      {!unlimited && (
        <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
          <div
            className={`h-full rounded-full ${near ? "bg-warning/100" : "bg-clay"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {note && <div className="mt-2 text-[11px] text-faint">{note}</div>}
    </div>
  );
}
