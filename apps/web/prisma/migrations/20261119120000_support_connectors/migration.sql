-- CreateTable
CREATE TABLE "SupportConnector" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'NONE',
    "authHeader" TEXT,
    "secretCipher" TEXT,
    "secretHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportConnector_projectId_idx" ON "SupportConnector"("projectId");

-- AddForeignKey
ALTER TABLE "SupportConnector" ADD CONSTRAINT "SupportConnector_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
