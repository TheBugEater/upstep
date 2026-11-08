import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "../site-url";
import { CollaborationError } from "../project-collaboration";
import { auth } from "../auth";
import { db } from "../db";
import { getProjectFromRequest } from "../sdk-auth";
import { enforceProjectAndClientLimits } from "../rate-limit";
import {
  authenticateSupportSession,
  supportProject,
  supportTeamAccess,
} from "./service";
import { SupportError, supportCors } from "./policy";

export async function teamRequest(
  req: NextRequest,
  projectId: string,
  manage = false,
) {
  const origin = req.headers.get("origin");
  if (
    req.method !== "GET" &&
    origin &&
    origin !== new URL(process.env.AUTH_URL || getSiteUrl()).origin
  )
    throw new SupportError("Invalid request origin.", 403);
  const session = await auth();
  if (!session?.user?.id) throw new SupportError("Unauthorized", 401);
  const access = await supportTeamAccess(projectId, session.user.id, manage);
  return { userId: session.user.id, access };
}
export async function sdkRequest(
  req: NextRequest,
  sessionRequired = false,
  write = false,
) {
  const project = await getProjectFromRequest(req);
  if (!project) throw new SupportError("Invalid project key.", 401);
  const p = await supportProject(project.id);
  if (!p.supportConfig?.enabled)
    throw new SupportError("Support is not enabled.", 404);
  const origin = req.headers.get("origin");
  if (origin) {
    let valid = false;
    try {
      const u = new URL(origin);
      valid =
        u.protocol === "https:" &&
        !u.port &&
        (u.hostname === p.supportConfig.domain ||
          u.hostname.endsWith(`.${p.supportConfig.domain}`));
      if (u.origin === new URL(process.env.AUTH_URL || getSiteUrl()).origin)
        valid = true;
      if (
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      )
        valid = true;
    } catch {
      /* reject */
    }
    if (!valid)
      throw new SupportError("Support is not enabled for this website.", 403);
  }
  const limited = await enforceProjectAndClientLimits(
    req,
    p.id,
    write ? "support-write" : "support-read",
    { project: write ? 300 : 3000, client: write ? 30 : 180 },
  );
  if (limited)
    throw new SupportError("Too many requests. Please try again shortly.", 429);
  const session = sessionRequired
    ? await authenticateSupportSession(
        p.id,
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "",
      )
    : null;
  return { project: p, config: p.supportConfig, session };
}
export async function customerConversation(
  projectId: string,
  customerId: string,
  conversationId: string,
) {
  const c = await db.supportConversation.findFirst({
    where: { id: conversationId, projectId, customerId },
  });
  if (!c) throw new SupportError("Conversation not found.", 404);
  return c;
}
export function supportResponseError(error: unknown, sdk = false) {
  const status =
    error instanceof SupportError || error instanceof CollaborationError
      ? error.status
      : 500;
  return NextResponse.json(
    {
      error:
        error instanceof SupportError || error instanceof CollaborationError
          ? error.message
          : "Could not complete this request. Please try again.",
    },
    { status, headers: sdk ? supportCors : { "Cache-Control": "no-store" } },
  );
}
export const publicMessageSelect = {
  id: true,
  role: true,
  authorName: true,
  content: true,
  metadata: true,
  createdAt: true,
} as const;
