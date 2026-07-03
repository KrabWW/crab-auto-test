-- Phase 3 test-suite support. Clean-room model: ordered case membership plus
-- self-contained suite runs that store execution ids, no FK added to executions.

CREATE TABLE "TestSuite" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestSuiteCase" (
  "id" TEXT NOT NULL,
  "suiteId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,

  CONSTRAINT "TestSuiteCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuiteRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "suiteId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "executionIds" TEXT[],
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SuiteRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TestSuite_projectId_createdAt_idx" ON "TestSuite"("projectId", "createdAt");
CREATE UNIQUE INDEX "TestSuiteCase_suiteId_testCaseId_key" ON "TestSuiteCase"("suiteId", "testCaseId");
CREATE INDEX "TestSuiteCase_suiteId_order_idx" ON "TestSuiteCase"("suiteId", "order");
CREATE INDEX "SuiteRun_projectId_startedAt_idx" ON "SuiteRun"("projectId", "startedAt");
CREATE INDEX "SuiteRun_suiteId_startedAt_idx" ON "SuiteRun"("suiteId", "startedAt");

ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuiteRun" ADD CONSTRAINT "SuiteRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuiteRun" ADD CONSTRAINT "SuiteRun_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
