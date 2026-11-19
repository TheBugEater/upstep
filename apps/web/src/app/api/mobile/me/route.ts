import { NextRequest, NextResponse } from "next/server";
import { mobileRequest, revokeMobileSession } from "@/lib/mobile/auth";
import { db } from "@/lib/db";
import { supportResponseError } from "@/lib/support/http";
import { saveMobileSupportProfile } from "@/lib/mobile/profile";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await mobileRequest(req);
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, supportDisplayName: true },
    });
    const projects = await db.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        owner: { plan: { in: ["PRO", "BUSINESS"] } },
      },
      select: {
        id: true,
        name: true,
        supportConfig: { select: { enabled: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    });
    return NextResponse.json(
      { user, projects },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
export async function PUT(req: NextRequest) {
  try {
    const profile = await saveMobileSupportProfile(req, await req.json().catch(() => null));
    return NextResponse.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return supportResponseError(e);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await mobileRequest(req);
    await revokeMobileSession(sessionId);
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
