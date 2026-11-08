export class SupportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function supportLimits(plan: string) {
  if (plan === "BUSINESS")
    return { enabled: true, aiReplies: 1500, pages: 150 };
  if (plan === "PRO") return { enabled: true, aiReplies: 300, pages: 40 };
  return { enabled: false, aiReplies: 0, pages: 0 };
}
export function requireSupportPlan(plan: string) {
  if (!supportLimits(plan).enabled)
    throw new SupportError("Customer support is available on paid plans.", 402);
}
export function usageMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}
export const PRESENCE_TTL_MS = 90_000;
export const SUPPORT_SESSION_MS = 30 * 24 * 60 * 60_000;
export const SUPPORT_MODES = ["AI_FIRST", "HUMAN_FIRST", "HUMAN_ONLY"] as const;
export const supportCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Cache-Control": "no-store",
};
