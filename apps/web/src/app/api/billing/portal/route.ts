import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, appUrl } from "@/lib/stripe";

export async function POST() {
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

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet. Upgrade to a paid plan first." },
      { status: 400 }
    );
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: appUrl("/dashboard/billing"),
  });

  return NextResponse.json({ url: portal.url });
}
