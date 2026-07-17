import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/projects/[id]/rotate-key ──────────────────────────────────────
// Generates a new public SDK key and invalidates the old one. This credential
// is intentionally never accepted by privileged dashboard or MCP endpoints.

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newApiKey = `upstep_pk_${randomBytes(24).toString("base64url")}`;

  const updated = await db.project.update({
    where: { id },
    data: { apiKey: newApiKey },
  });

  return NextResponse.json({ apiKey: updated.apiKey });
}
