import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mobileRequest } from "@/lib/mobile/auth";
import { supportTeamAccess } from "@/lib/support/service";
import { supportResponseError } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const { userId } = await mobileRequest(req);
    await supportTeamAccess(id, userId);
    const [preference, project] = await Promise.all([
      db.supportPushPreference.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      }),
      db.project.findUniqueOrThrow({
        where: { id },
        select: {
          owner: { select: { id: true, name: true } },
          members: { select: { user: { select: { id: true, name: true } } } },
        },
      }),
    ]);
    return NextResponse.json(
      {
        preference,
        teammates: [project.owner, ...project.members.map((m) => m.user)],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
const schema = z.object({
  enabled: z.boolean(),
  onCall: z.boolean(),
  quietUntil: z.string().datetime().nullable(),
});
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const { userId } = await mobileRequest(req);
    await supportTeamAccess(id, userId);
    const input = schema.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new SupportError("Invalid notification preferences.");
    const data = {
      ...input.data,
      quietUntil: input.data.quietUntil
        ? new Date(input.data.quietUntil)
        : null,
    };
    await db.supportPushPreference.upsert({
      where: { projectId_userId: { projectId: id, userId } },
      create: { projectId: id, userId, ...data },
      update: data,
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
