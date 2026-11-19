import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ACCOUNT_SECTIONS, accountSupportData, authorizeAccountConnector, type AccountSection } from "@/lib/support/account-data";
import { SupportError } from "@/lib/support/policy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ customerId: string; section: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    authorizeAccountConnector(req.headers.get("authorization"));
    const { customerId, section } = await params;
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(customerId) || !ACCOUNT_SECTIONS.includes(section as AccountSection))
      throw new SupportError("Lookup not found.", 404);
    const limit = await checkRateLimit({ scope: "support-account-data", identifier: customerId, limit: 30, windowMs: 60_000 });
    if (!limit.allowed) throw new SupportError("Too many lookups. Please try again shortly.", 429);
    return NextResponse.json(await accountSupportData(customerId, section as AccountSection), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportError ? error.message : "Account information is temporarily unavailable." },
      { status: error instanceof SupportError ? error.status : 503, headers });
  }
}
