import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getProjectFromRequest, getFingerprint } from "@/lib/sdk-auth";
import { triggerIntegrations } from "@/lib/integrations";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const voteSchema = z.object({
  value: z.enum(["UP", "DOWN"]),
  endUserId: z.string().optional(),
});

// ─── POST /api/sdk/feedback/[id]/vote ────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const project = await getProjectFromRequest(req);
  if (!project) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const { id } = await params;
  const feedback = await db.feedback.findFirst({
    where: { id, projectId: project.id },
  });
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS });
  }

  const { value, endUserId } = parsed.data;
  const fingerprint = getFingerprint(req);

  if (endUserId) {
    // Authenticated path — upsert with deduplication
    const existing = await db.vote.findUnique({
      where: { feedbackId_endUserId: { feedbackId: id, endUserId } },
    });

    if (existing) {
      if (existing.value === value) {
        // Same vote again — remove it (toggle off)
        await db.vote.delete({ where: { id: existing.id } });
        await adjustCounts(id, value, -1);
        return NextResponse.json({ removed: true }, { headers: CORS });
      }
      // Flip the vote
      await db.vote.update({ where: { id: existing.id }, data: { value } });
      await adjustCounts(id, existing.value, -1);
      await adjustCounts(id, value, +1);
      return NextResponse.json({ flipped: true }, { headers: CORS });
    }

    await db.vote.create({ data: { feedbackId: id, value, endUserId } });
  } else {
    // Anonymous path — fingerprint only, no uniqueness enforced
    await db.vote.create({ data: { feedbackId: id, value, fingerprint } });
  }

  await adjustCounts(id, value, +1);

  const updatedFeedback = await db.feedback.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, type: true, upvotes: true, downvotes: true },
  });
  if (updatedFeedback) {
    void triggerIntegrations({
      event: "NEW_VOTE",
      project: { id: project.id, name: project.name },
      feedback: { ...updatedFeedback },
      vote: { value },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: CORS });
}

// ─── DELETE /api/sdk/feedback/[id]/vote ──────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const project = await getProjectFromRequest(req);
  if (!project) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const endUserId = searchParams.get("endUserId");
  if (!endUserId) {
    return NextResponse.json({ error: "endUserId required" }, { status: 400, headers: CORS });
  }

  const vote = await db.vote.findUnique({
    where: { feedbackId_endUserId: { feedbackId: id, endUserId } },
  });
  if (!vote) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404, headers: CORS });
  }

  await db.vote.delete({ where: { id: vote.id } });
  await adjustCounts(id, vote.value, -1);

  return NextResponse.json({ ok: true }, { headers: CORS });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function adjustCounts(feedbackId: string, value: "UP" | "DOWN", delta: number) {
  await db.feedback.update({
    where: { id: feedbackId },
    data:
      value === "UP"
        ? { upvotes: { increment: delta } }
        : { downvotes: { increment: delta } },
  });
}
