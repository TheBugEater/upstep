import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, appUrl } from "@/lib/stripe";
import { getPlan } from "@/lib/plans";

const schema = z.object({
  planId: z.enum(["PRO", "BUSINESS"]),
  currency: z.enum(["USD", "GBP", "EUR"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = getPlan(parsed.data.planId);
  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the ${plan.name} plan.` },
      { status: 503 }
    );
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Reuse or create the Stripe customer for this account.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      ...(user.name ? { name: user.name } : {}),
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    // The price is multi-currency (currency_options); this selects which one.
    ...(parsed.data.currency ? { currency: parsed.data.currency.toLowerCase() } : {}),
    success_url: appUrl("/dashboard/billing?upgraded=1"),
    cancel_url: appUrl("/dashboard/billing"),
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: user.id, planId: plan.id } },
    metadata: { userId: user.id, planId: plan.id },
  });

  return NextResponse.json({ url: checkout.url });
}
