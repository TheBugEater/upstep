import { NextRequest, NextResponse } from "next/server";
import { getPlan } from "@/lib/plans";
import { z } from "zod";
import { sdkRequest, supportResponseError } from "@/lib/support/http";
import { availableAgents, createSupportSession } from "@/lib/support/service";
import { SupportError, supportCors } from "@/lib/support/policy";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: supportCors });
}
export async function GET(req: NextRequest) {
  try {
    const { project, config } = await sdkRequest(req);
    const online = await availableAgents(project.id);
    return NextResponse.json(
      {
        enabled: true,
        showBranding: getPlan(project.owner.plan).branding,
        domain: config.domain,
        businessName: config.businessName,
        welcomeMessage: config.welcomeMessage,
        mode: config.mode,
        online: online.map((a) => ({ name: a.user.name || "Teammate" })),
      },
      { headers: supportCors },
    );
  } catch (e) {
    return supportResponseError(e, true);
  }
}
const schema = z.object({ identityToken: z.string().max(4096).optional() });
export async function POST(req: NextRequest) {
  try {
    const { project } = await sdkRequest(req, false, true);
    const limit = await checkRateLimit({
      scope: "support-sessions",
      identifier: `${project.id}:${requestIdentifier(req)}`,
      limit: 15,
      windowMs: 60 * 60_000,
    });
    if (!limit.allowed)
      throw new SupportError("Too many chat sessions. Try again later.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new SupportError("Invalid identity.");
    return NextResponse.json(
      await createSupportSession(project.id, parsed.data.identityToken),
      { headers: supportCors },
    );
  } catch (e) {
    return supportResponseError(e, true);
  }
}
