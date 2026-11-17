import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createLoginCode,
  MOBILE_CALLBACK,
  validChallenge,
} from "@/lib/mobile/auth";
import { getSiteUrl } from "@/lib/site-url";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { SupportError } from "@/lib/support/policy";
import { supportResponseError } from "@/lib/support/http";

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== new URL(process.env.AUTH_URL || getSiteUrl()).origin)
      throw new SupportError("Invalid request origin.", 403);
    const session = await auth();
    if (!session?.user?.id) throw new SupportError("Please sign in.", 401);
    const form = await req.formData();
    const challenge = String(form.get("challenge") || "");
    const state = String(form.get("state") || "");
    if (!validChallenge(challenge) || !validChallenge(state))
      throw new SupportError("Invalid sign-in request.");
    const limit = await checkRateLimit({
      scope: "mobile-authorize",
      identifier: session.user.id,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (!limit.allowed) return rateLimitResponse(limit);
    const code = await createLoginCode(session.user.id, challenge);
    const callback = new URL(MOBILE_CALLBACK);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    return NextResponse.redirect(callback, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return supportResponseError(e);
  }
}
