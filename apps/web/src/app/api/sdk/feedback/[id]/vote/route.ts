import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getProjectFromRequest, getFingerprint } from "@/lib/sdk-auth";
import { enforceProjectAndClientLimits, rateLimitResponse } from "@/lib/rate-limit";
import { kickNotificationProcessor, queueIntegration } from "@/lib/notification-queue";

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
  endUserId: z.string().max(200).optional(),
  anonymousId: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const project = await getProjectFromRequest(req);
  if (!project) return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });

  const limited = await enforceProjectAndClientLimits(req, project.id, "sdk-vote", {
    project: 1_000,
    client: 120,
  });
  if (limited) return rateLimitResponse(limited, CORS);

  const parsed = voteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS });

  const { id } = await params;
  const { value, endUserId, anonymousId } = parsed.data;
  const fingerprint = getFingerprint(req);

  try {
    const result = await serializable(async (tx) => {
      const feedback = await tx.feedback.findFirst({ where: { id, projectId: project.id } });
      if (!feedback) return null;

      const existing = endUserId
        ? await tx.vote.findUnique({ where: { feedbackId_endUserId: { feedbackId: id, endUserId } } })
        : anonymousId
          ? await tx.vote.findUnique({ where: { feedbackId_anonymousId: { feedbackId: id, anonymousId } } })
          : await tx.vote.findFirst({ where: { feedbackId: id, fingerprint } });

      if (existing?.value === value) {
        await tx.vote.delete({ where: { id: existing.id } });
        await updateCount(tx, id, value, -1);
        return { response: { removed: true }, status: 200 };
      }

      if (existing) {
        await tx.vote.update({ where: { id: existing.id }, data: { value } });
        await tx.feedback.update({
          where: { id },
          data: {
            upvotes: { increment: value === "UP" ? 1 : -1 },
            downvotes: { increment: value === "DOWN" ? 1 : -1 },
          },
        });
        return { response: { flipped: true }, status: 200 };
      }

      await tx.vote.create({
        data: { feedbackId: id, value, ...(endUserId ? { endUserId } : anonymousId ? { anonymousId } : {}), fingerprint },
      });
      const updated = await tx.feedback.update({
        where: { id },
        data: value === "UP" ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
        select: { id: true, title: true, content: true, type: true, upvotes: true, downvotes: true },
      });
      await queueIntegration({
        event: "NEW_VOTE",
        project: { id: project.id, name: project.name },
        feedback: updated,
        vote: { value },
      }, tx);
      return { response: { ok: true }, status: 201 };
    });

    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
    if (result.status === 201) kickNotificationProcessor();
    return NextResponse.json(result.response, { status: result.status, headers: CORS });
  } catch (error) {
    console.error("Vote transaction failed", error);
    return NextResponse.json({ error: "Could not save vote" }, { status: 409, headers: CORS });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const project = await getProjectFromRequest(req);
  if (!project) return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });

  const limited = await enforceProjectAndClientLimits(req, project.id, "sdk-vote", {
    project: 1_000,
    client: 120,
  });
  if (limited) return rateLimitResponse(limited, CORS);

  const { id } = await params;
  const endUserId = req.nextUrl.searchParams.get("endUserId");
  const anonymousId = req.nextUrl.searchParams.get("anonymousId");
  if (!endUserId && !anonymousId) {
    return NextResponse.json({ error: "endUserId or anonymousId required" }, { status: 400, headers: CORS });
  }

  const removed = await serializable(async (tx) => {
    const feedback = await tx.feedback.findFirst({ where: { id, projectId: project.id }, select: { id: true } });
    if (!feedback) return false;
    const vote = endUserId
      ? await tx.vote.findUnique({ where: { feedbackId_endUserId: { feedbackId: id, endUserId } } })
      : await tx.vote.findUnique({ where: { feedbackId_anonymousId: { feedbackId: id, anonymousId: anonymousId! } } });
    if (!vote) return false;
    await tx.vote.delete({ where: { id: vote.id } });
    await updateCount(tx, id, vote.value, -1);
    return true;
  });

  if (!removed) return NextResponse.json({ error: "Vote not found" }, { status: 404, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}

async function updateCount(tx: Prisma.TransactionClient, feedbackId: string, value: "UP" | "DOWN", delta: number) {
  await tx.feedback.update({
    where: { id: feedbackId },
    data: value === "UP" ? { upvotes: { increment: delta } } : { downvotes: { increment: delta } },
  });
}

async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
