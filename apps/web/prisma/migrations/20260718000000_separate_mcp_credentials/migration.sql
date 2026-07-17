-- Public SDK keys were previously accepted by the privileged MCP endpoint.
-- Existing MCP access is intentionally revoked; owners must generate a new
-- MCP-only secret from the dashboard after this migration.
ALTER TABLE "Project" ADD COLUMN "mcpKeyHash" TEXT;
CREATE UNIQUE INDEX "Project_mcpKeyHash_key" ON "Project"("mcpKeyHash");

-- Password registration was never connected to an authentication provider.
ALTER TABLE "User" DROP COLUMN "password";
