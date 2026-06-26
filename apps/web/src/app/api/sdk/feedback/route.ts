import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getProjectFromRequest } from "@/lib/sdk-auth";
import { getPlan } from "@/lib/plans";
import { containsProfanity } from "@/lib/profanity";
import { sendFeedbackNotification } from "@/lib/email";
import { triggerIntegrations } from "@/lib/integrations";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ─── GET /api/sdk/feedback ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const project = await getProjectFromRequest(req);
  if (!project) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const cursor = searchParams.get("cursor") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") === "votes" ? "upvotes" : "createdAt";
  // When the SDK knows the end-user, include their own PENDING items so the
  // submitter can see their submission is in review on mobile.
  const endUserId = searchParams.get("endUserId") ?? undefined;

  const items = await db.feedback.findMany({
    where: {
      projectId: project.id,
      ...(type ? { type: type as never } : {}),
      // If caller explicitly filters by status, honour it.
      // Otherwise hide PENDING — unless the item belongs to the requesting user.
      // Also exclude items whose custom board status is marked as done.
      internal: false,
      NOT: { boardStatus: { isDone: true } },
      ...(status
        ? { status: status as never }
        : endUserId
          ? {
              OR: [
                { status: { notIn: ["PENDING", "CLOSED", "DONE"] as const } },
                { status: "PENDING" as const, endUserId },
              ],
            }
          : { status: { notIn: ["PENDING", "CLOSED", "DONE"] as const } }),
    },
    orderBy: { [sort]: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  const showBranding = getPlan(project.owner.plan).branding;

  // Attach the requesting user's vote to each item so the SDK can show voted state.
  if (endUserId && page.length > 0) {
    const votes = await db.vote.findMany({
      where: { endUserId, feedbackId: { in: page.map((i) => i.id) } },
      select: { feedbackId: true, value: true },
    });
    const voteMap = new Map(votes.map((v) => [v.feedbackId, v.value]));
    const withVotes = page.map((i) => ({ ...i, userVote: voteMap.get(i.id) ?? null }));
    return NextResponse.json({ items: withVotes, nextCursor, showBranding }, { headers: CORS });
  }

  return NextResponse.json({ items: page, nextCursor, showBranding }, { headers: CORS });
}

// ─── POST /api/sdk/feedback ───────────────────────────────────────────────────

const submitSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(2000),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  endUserId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const project = await getProjectFromRequest(req);
  if (!project) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS });
  }

  // Burst guard: no more than 10 submissions per project in any 60-second window.
  const since = new Date(Date.now() - 60_000);
  const recentCount = await db.feedback.count({
    where: { projectId: project.id, createdAt: { gte: since } },
  });
  if (recentCount >= 10) {
    return NextResponse.json(
      { error: "Too many submissions. Please slow down." },
      { status: 429, headers: { ...CORS, "Retry-After": "60" } }
    );
  }

  // Enforce the per-project feedback cap for the owner's plan.
  const plan = getPlan(project.owner.plan);
  if (Number.isFinite(plan.feedbackLimit)) {
    const count = await db.feedback.count({ where: { projectId: project.id } });
    if (count >= plan.feedbackLimit) {
      return NextResponse.json(
        { error: "This project has reached its feedback limit." },
        { status: 402, headers: CORS }
      );
    }
  }

  const { title, content, endUserId } = parsed.data;
  const status = project.moderationEnabled ? "PENDING" : "OPEN";
  const flagged = containsProfanity(content);

  // Auto-assign to the first non-done status so new submissions appear on the board
  const defaultStatus = await db.status.findFirst({
    where: { projectId: project.id, isDone: false },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  // Creator gets an automatic upvote.
  const feedback = await db.feedback.create({
    data: {
      projectId: project.id,
      ...(title ? { title } : {}),
      content,
      type: parsed.data.type ?? "GENERAL",
      status,
      flagged,
      upvotes: 1,
      ...(defaultStatus ? { statusId: defaultStatus.id } : {}),
      ...(endUserId ? { endUserId } : {}),
      ...(parsed.data.metadata ? { metadata: parsed.data.metadata as object } : {}),
      // Record the vote so the creator can't double-vote later.
      ...(endUserId
        ? { votes: { create: { value: "UP", endUserId } } }
        : {}),
    },
  });

  // Fire notifications — non-blocking, never fails the request
  void triggerIntegrations({
    event: "NEW_FEEDBACK",
    project: { id: project.id, name: project.name },
    feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type, status: feedback.status, flagged: feedback.flagged },
  }).catch(() => {});

  void sendFeedbackNotification({
    toEmail: project.owner.email,
    projectName: project.name,
    projectId: project.id,
    feedback: {
      title: feedback.title ?? null,
      content: feedback.content,
      type: feedback.type,
      flagged: feedback.flagged,
      status: feedback.status,
    },
  }).catch(() => {});

  return NextResponse.json(feedback, { status: 201, headers: CORS });
}
