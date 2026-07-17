import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getProjectFromRequest } from "@/lib/sdk-auth";
import { getPlan } from "@/lib/plans";
import { containsProfanity } from "@/lib/profanity";
import { enforceProjectAndClientLimits, rateLimitResponse } from "@/lib/rate-limit";
import { kickNotificationProcessor, queueEmail, queueIntegration } from "@/lib/notification-queue";

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
  const limited = await enforceProjectAndClientLimits(req, project.id, "sdk-feedback-read", {
    project: 2_000,
    client: 120,
  });
  if (limited) return rateLimitResponse(limited, CORS);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const cursor = searchParams.get("cursor") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") === "votes" ? "upvotes" : "createdAt";
  // When the SDK knows the end-user (or has a client-persisted anonymous id),
  // include their own PENDING items so the submitter can see their
  // submission is in review on mobile.
  const endUserId = searchParams.get("endUserId") ?? undefined;
  const anonymousId = searchParams.get("anonymousId") ?? undefined;

  const items = await db.feedback.findMany({
    where: {
      projectId: project.id,
      ...(type ? { type: type as never } : {}),
      // If caller explicitly filters by status, honour it.
      // Otherwise hide PENDING - unless the item belongs to the requesting user.
      // Also exclude items whose custom board status is marked as done.
      internal: false,
      NOT: { boardStatus: { isDone: true } },
      ...(status
        ? { status: status as never }
        : endUserId || anonymousId
          ? {
              OR: [
                { status: { notIn: ["PENDING", "CLOSED", "DONE"] as const } },
                {
                  status: "PENDING" as const,
                  ...(endUserId ? { endUserId } : anonymousId ? { anonymousId } : {}),
                },
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
  if ((endUserId || anonymousId) && page.length > 0) {
    const votes = await db.vote.findMany({
      where: {
        feedbackId: { in: page.map((i) => i.id) },
        ...(endUserId ? { endUserId } : anonymousId ? { anonymousId } : {}),
      },
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
  endUserId: z.string().max(200).optional(),
  anonymousId: z.string().max(200).optional(),
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

  const limited = await enforceProjectAndClientLimits(req, project.id, "sdk-feedback-submit", {
    project: 60,
    client: 5,
  });
  if (limited) return rateLimitResponse(limited, CORS);

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

  const { title, content, endUserId, anonymousId } = parsed.data;
  if (parsed.data.metadata && JSON.stringify(parsed.data.metadata).length > 8_192) {
    return NextResponse.json({ error: "metadata must be 8 KB or smaller" }, { status: 400, headers: CORS });
  }
  const status = project.moderationEnabled ? "PENDING" : "OPEN";
  const flagged = containsProfanity(content);

  // Auto-assign to the first non-done status so new submissions appear on the board
  const defaultStatus = await db.status.findFirst({
    where: { projectId: project.id, isDone: false },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  // Creator gets an automatic upvote.
  const feedback = await db.$transaction(async (tx) => {
    const created = await tx.feedback.create({
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
        ...(anonymousId ? { anonymousId } : {}),
        ...(parsed.data.metadata ? { metadata: parsed.data.metadata as object } : {}),
        ...(endUserId
          ? { votes: { create: { value: "UP", endUserId } } }
          : anonymousId
            ? { votes: { create: { value: "UP", anonymousId } } }
            : {}),
      },
    });
    await Promise.all([
      queueIntegration({
        event: "NEW_FEEDBACK",
        project: { id: project.id, name: project.name },
        feedback: { id: created.id, title: created.title, content: created.content, type: created.type, status: created.status, flagged: created.flagged },
      }, tx),
      queueEmail({
        toEmail: project.owner.email,
        projectName: project.name,
        projectId: project.id,
        feedback: { title: created.title, content: created.content, type: created.type, flagged: created.flagged, status: created.status },
      }, tx),
    ]);
    return created;
  });
  kickNotificationProcessor();

  return NextResponse.json(feedback, { status: 201, headers: CORS });
}
