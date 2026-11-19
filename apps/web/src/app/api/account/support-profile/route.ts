import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { getSupportProfile, saveSupportProfile, supportProfileSchema } from "@/lib/support/profile";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  return NextResponse.json(await getSupportProfile(userId), { headers });
}

export async function PUT(req: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(getSiteUrl()).origin)
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  const parsed = supportProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a support name of up to 80 characters on a single line." }, { status: 400, headers });
  return NextResponse.json(await saveSupportProfile(userId, parsed.data), { headers });
}
