CREATE TABLE "Label" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_FeedbackToLabel" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

ALTER TABLE "Label"
  ADD CONSTRAINT "Label_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_FeedbackToLabel"
  ADD CONSTRAINT "_FeedbackToLabel_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Feedback"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_FeedbackToLabel"
  ADD CONSTRAINT "_FeedbackToLabel_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Label"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Label_projectId_name_key" ON "Label"("projectId", "name");
CREATE UNIQUE INDEX "_FeedbackToLabel_AB_unique" ON "_FeedbackToLabel"("A", "B");
CREATE INDEX "_FeedbackToLabel_B_index" ON "_FeedbackToLabel"("B");
