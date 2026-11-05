ALTER TYPE "MemberRole" ADD VALUE 'ADMIN';
ALTER TABLE "Feedback" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "authorId" TEXT, ADD COLUMN "parentId" TEXT;
CREATE INDEX "Feedback_projectId_assigneeId_status_idx" ON "Feedback"("projectId", "assigneeId", "status");
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
