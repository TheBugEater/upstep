import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teamRequest, supportResponseError } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import {
  beginBusinessLearning,
  confirmBusinessLearning,
  reviewSchema,
} from "@/lib/support/learning";
import { processSupportJobs } from "@/lib/support/worker";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("learn"),
    domain: z.string().trim().min(3).max(253),
  }),
  z.object({ action: z.literal("confirm"), review: reviewSchema }),
]);
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new SupportError(
        "Check the website, contact email, business details and review answers.",
      );
    if (parsed.data.action === "learn")
      await beginBusinessLearning(id, parsed.data.domain);
    else await confirmBusinessLearning(id, parsed.data.review);
    after(() => processSupportJobs().then(() => {}));
    return NextResponse.json({ saved: true });
  } catch (error) {
    return supportResponseError(error);
  }
}
