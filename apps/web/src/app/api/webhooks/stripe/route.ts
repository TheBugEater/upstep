import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { planIdForPrice } from "@/lib/plans";

// Stripe needs the raw, unparsed body to verify the signature.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      const subscriptionId =
        typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      if (customerId && subscriptionId) {
        // Resolve the active price -> plan from the subscription.
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(customerId, sub);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await syncSubscription(customerId, sub);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "FREE", stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

/** Map a subscription's active price to a plan and persist it on the user. */
async function syncSubscription(customerId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  const planId = planIdForPrice(priceId);

  // Active/trialing keeps the paid plan; anything else drops to Free.
  const isActive = sub.status === "active" || sub.status === "trialing";
  const plan = isActive && planId ? planId : "FREE";

  await db.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan, stripeSubscriptionId: isActive ? sub.id : null },
  });
}
