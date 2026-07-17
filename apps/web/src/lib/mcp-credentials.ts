import { createHash, randomBytes } from "node:crypto";

export const MCP_KEY_PREFIX = "upstep_mcp_";

export function generateMcpKey() {
  return `${MCP_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashMcpKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function isMcpKey(value: string) {
  return value.startsWith(MCP_KEY_PREFIX) && value.length > MCP_KEY_PREFIX.length + 32;
}
