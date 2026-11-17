import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exchangeLoginCode, refreshMobileSession } from "@/lib/mobile/auth";
import {
  checkRateLimit,
  requestIdentifier,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { SupportError } from "@/lib/support/policy";
import { supportResponseError } from "@/lib/support/http";

const schema = z.discriminatedUnion("grantType", [
  z.object({
    grantType: z.literal("code"),
    code: z.string().max(128),
    verifier: z.string().max(128),
  }),
  z.object({
    grantType: z.literal("refresh"),
    refreshToken: z.string().max(128),
  }),
]);
export async function POST(req: NextRequest) {
  try {
    const limit = await checkRateLimit({
      scope: "mobile-token",
      identifier: requestIdentifier(req),
      limit: 60,
      windowMs: 60_000,
    });
    if (!limit.allowed) return rateLimitResponse(limit);
    const input = schema.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new SupportError("Invalid token request.");
    const data = input.data;
    const tokens =
      data.grantType === "code"
        ? await exchangeLoginCode(data.code, data.verifier)
        : await refreshMobileSession(data.refreshToken);
    return NextResponse.json(tokens, {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (e) {
    return supportResponseError(e);
  }
}
