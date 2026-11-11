import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseAvatarSource } from "@/lib/avatar";
import { setAvatarSource } from "@/lib/avatar-sync";

const bodySchema = z.object({ source: z.enum(["GITHUB", "GOOGLE", "INITIALS"]) });

// ─── PUT /api/account/avatar ─────────────────────────────────────────────────
// Choose which linked provider's picture to show, or initials.

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose GitHub, Google or initials." }, { status: 400 });

  const accounts = await db.account.findMany({ where: { userId: session.user.id }, select: { provider: true, image: true } });
  if (!canUseAvatarSource(parsed.data.source, accounts)) {
    return NextResponse.json({ error: "Link that account before using its picture." }, { status: 400 });
  }

  const image = await setAvatarSource(session.user.id, parsed.data.source);
  return NextResponse.json({ source: parsed.data.source, image });
}
