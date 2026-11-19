import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { accountSupportProject } from "@/lib/support/account-data";
import { identitySecret } from "@/lib/support/identity";
import { SupportError } from "@/lib/support/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const session = await auth();
    if (!session?.user?.id) throw new SupportError("Unauthorized", 401);
    const limit = await checkRateLimit({ scope: "own-support-identity", identifier: session.user.id, limit: 20, windowMs: 60_000 });
    if (!limit.allowed) throw new SupportError("Too many requests.", 429);
    const project = await accountSupportProject();
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true } });
    if (!user) throw new SupportError("Unauthorized", 401);
    const iat = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: user.id, aud: project.id, iat, exp: iat + 600,
      ...(user.name ? { name: user.name.slice(0, 100) } : {}), email: user.email,
    })).toString("base64url");
    const signature = createHmac("sha256", identitySecret(project.id)).update(`${head}.${body}`).digest("base64url");
    return NextResponse.json({ token: `${head}.${body}.${signature}` }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportError ? error.message : "Support identity is unavailable." },
      { status: error instanceof SupportError ? error.status : 503, headers });
  }
}
