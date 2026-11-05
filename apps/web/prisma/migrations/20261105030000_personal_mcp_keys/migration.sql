CREATE TABLE "McpCredential" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "McpCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "McpCredential_keyHash_key" ON "McpCredential"("keyHash");
CREATE UNIQUE INDEX "McpCredential_projectId_userId_key" ON "McpCredential"("projectId", "userId");
CREATE INDEX "McpCredential_userId_idx" ON "McpCredential"("userId");
ALTER TABLE "McpCredential" ADD CONSTRAINT "McpCredential_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpCredential" ADD CONSTRAINT "McpCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
