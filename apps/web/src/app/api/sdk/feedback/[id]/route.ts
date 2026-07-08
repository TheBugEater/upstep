import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProjectFromRequest } from "@/lib/sdk-auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ─── GET /api/sdk/feedback/[id] ──────────────────────────────────────────────
// Returns a single feedback item with its developer comments.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const project = await getProjectFromRequest(req);
  if (!project) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const { id } = await params;
  const endUserId = req.nextUrl.searchParams.get("endUserId") ?? undefined;
  const anonymousId = req.nextUrl.searchParams.get("anonymousId") ?? undefined;

  const item = await db.feedback.findFirst({
    where: { id, projectId: project.id },
    include: {
      comments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  // Attach the requesting user's vote so the SDK can show voted state.
  let userVote: string | null = null;
  if (endUserId || anonymousId) {
    const vote = await db.vote.findFirst({
      where: { feedbackId: id, ...(endUserId ? { endUserId } : anonymousId ? { anonymousId } : {}) },
      select: { value: true },
    });
    userVote = vote?.value ?? null;
  }

  return NextResponse.json({ ...item, userVote }, { headers: CORS });
}
