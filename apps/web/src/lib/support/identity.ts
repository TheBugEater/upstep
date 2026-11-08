import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { SupportError } from "./policy";

export const hashSupportToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newSupportToken = () => randomBytes(32).toString("base64url");
export function identitySecret(projectId: string) {
  const root = process.env.SUPPORT_IDENTITY_SECRET || process.env.AUTH_SECRET;
  if (!root) throw new SupportError("Support identity is not configured.", 503);
  return createHmac("sha256", root)
    .update(`upstep:support:identity:v1:${projectId}`)
    .digest("hex");
}
const claimsSchema = z.object({
  sub: z.string().min(1).max(200),
  aud: z.string(),
  exp: z.number().int(),
  iat: z.number().int(),
  name: z.string().trim().max(100).optional(),
  email: z.string().email().max(254).optional(),
});
export function verifyIdentity(
  token: string,
  projectId: string,
  now = Math.floor(Date.now() / 1000),
) {
  try {
    if (token.length > 4096) throw new Error();
    const [head, body, signature, extra] = token.split(".");
    if (!head || !body || !signature || extra) throw new Error();
    const header = JSON.parse(Buffer.from(head, "base64url").toString());
    if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error();
    const expected = createHmac("sha256", identitySecret(projectId))
      .update(`${head}.${body}`)
      .digest();
    const supplied = Buffer.from(signature, "base64url");
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw new Error();
    const claims = claimsSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString()),
    );
    if (
      claims.aud !== projectId ||
      claims.exp <= now ||
      claims.exp <= claims.iat ||
      claims.iat > now + 30 ||
      claims.iat < now - 900 ||
      claims.exp > claims.iat + 900
    )
      throw new Error();
    return claims;
  } catch {
    throw new SupportError("Invalid or expired customer identity.", 401);
  }
}
