-- Bind executions to the user who requested the run.
-- Backfill existing rows from the test case creator for pre-existing data.

ALTER TABLE "TestExecution" ADD COLUMN "createdBy" TEXT;

UPDATE "TestExecution" e
SET "createdBy" = tc."createdBy"
FROM "TestCase" tc
WHERE e."testCaseId" = tc."id";

ALTER TABLE "TestExecution" ALTER COLUMN "createdBy" SET NOT NULL;

CREATE INDEX "TestExecution_createdBy_status_idx" ON "TestExecution"("createdBy", "status");

ALTER TABLE "TestExecution"
ADD CONSTRAINT "TestExecution_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
