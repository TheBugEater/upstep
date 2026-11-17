import { NextRequest, NextResponse } from "next/server";
import { mobileRequest, revokeMobileSession } from "@/lib/mobile/auth";
import { db } from "@/lib/db";
import { supportResponseError } from "@/lib/support/http";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await mobileRequest(req);
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true },
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
export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await mobileRequest(req);
    await revokeMobileSession(sessionId);
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
