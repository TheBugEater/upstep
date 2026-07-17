import Link from "next/link";
import { PLANS, PLAN_ORDER, formatPrice } from "@/lib/plans";
import { detectCurrency } from "@/lib/currency";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { CurrencySwitcher } from "@/components/billing/CurrencySwitcher";

export async function Pricing({ heading = true }: { heading?: boolean }) {
  const currency = await detectCurrency();

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
      {heading && (
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-clay">
            Pricing
          </span>
          <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink">
            Simple pricing that scales with you
          </h2>
          <p className="mt-4 text-muted leading-relaxed">
            Start free. Upgrade when your feedback takes off. No setup fees,
            cancel anytime.
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <CurrencySwitcher current={currency} />
      </div>

      <div className="mt-10 grid md:grid-cols-3 gap-5 items-start">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const popular = plan.popular;
          const isFree = plan.id === "FREE";
          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-3xl border bg-card p-7 ${
                popular
                  ? "border-clay/40 shadow-lift md:-translate-y-2"
                  : "border-line shadow-soft"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-clay text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">
                  Most popular
                </span>
              )}

              <h3 className="font-semibold text-ink text-lg">{plan.name}</h3>
              <p className="text-sm text-muted mt-1 min-h-[40px]">
                {plan.tagline}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-ink">
                  {formatPrice(plan.id, currency)}
                </span>
                <span className="text-sm text-faint">/ month</span>
              </div>

              <div className="mt-6">
                {isFree ? (
                  <Link
                    href="/login"
                    className="block text-center w-full py-3 rounded-xl text-sm font-medium bg-surface border border-line text-ink hover:bg-card transition"
                  >
                    Get started free
                  </Link>
                ) : (
                  <CheckoutButton
                    planId={plan.id as "PRO" | "BUSINESS"}
                    currency={currency}
                    label={`Upgrade to ${plan.name}`}
                    className={`block text-center w-full py-3 rounded-xl text-sm font-medium transition ${
                      popular
                        ? "bg-clay text-white hover:bg-clay-hover shadow-soft"
                        : "bg-primary text-primary-fg hover:bg-primary/85"
                    }`}
                  />
                )}
              </div>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-ink-soft">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-clay/15 text-clay flex items-center justify-center text-[10px] shrink-0">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-faint mt-10">
        Prices shown in {currency}. Charged in your local currency at checkout.
        Need something custom?{" "}
        <a href="mailto:hello@upstep.dev" className="text-clay hover:underline">
          Talk to us
        </a>
        .
      </p>
    </section>
  );
}
