import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mobileRequest } from "@/lib/mobile/auth";
import { supportTeamAccess } from "@/lib/support/service";
import { SupportError } from "@/lib/support/policy";
import { supportResponseError } from "@/lib/support/http";

const registration = z.object({
  pushToken: z
    .string()
    .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
    .max(256),
  platform: z.enum(["ios", "android"]),
});
export async function PUT(req: NextRequest) {
  try {
    const { sessionId } = await mobileRequest(req);
    const input = registration.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new SupportError("Invalid notification registration.");
    await db.$transaction(async (tx) => {
      // Reinstallation/sign-in can reuse a token. Remove its previous session binding.
      await tx.mobileDevice.deleteMany({
        where: { sessionId, pushToken: { not: input.data.pushToken } },
      });
      await tx.mobileDevice.upsert({
        where: { pushToken: input.data.pushToken },
        create: { sessionId, ...input.data },
        update: { sessionId, platform: input.data.platform, enabled: true },
      });
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
const heartbeat = z.object({
  projectId: z.string().max(128).nullable(),
  conversationId: z.string().max(128).nullable(),
});
export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await mobileRequest(req);
    const input = heartbeat.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new SupportError("Invalid activity update.");
    const { projectId, conversationId } = input.data;
    if (conversationId) {
      if (!projectId) throw new SupportError("Project is required.");
      await supportTeamAccess(projectId, userId);
      if (
        !(await db.supportConversation.count({
          where: { id: conversationId, projectId },
        }))
      )
        throw new SupportError("Conversation not found.", 404);
    }
    await db.mobileDevice.updateMany({
      where: { sessionId },
      data: { activeConversationId: conversationId, lastActiveAt: new Date() },
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
