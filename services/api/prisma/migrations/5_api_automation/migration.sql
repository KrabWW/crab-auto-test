-- Phase 3 API automation: project-scoped HTTP cases, environments, assertions,
-- variable extraction, and immutable redacted execution reports.

CREATE TABLE "ApiSecret" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "credentialCiphertext" BYTEA NOT NULL,
  "credentialKeyId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApiSecret_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiEnvironment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "variables" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApiEnvironment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiTestCase" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "headers" JSONB NOT NULL,
  "body" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApiTestCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiAssertion" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "target" TEXT,
  "operator" TEXT NOT NULL,
  "expected" TEXT,

  CONSTRAINT "ApiAssertion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiVariableExtraction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "path" TEXT NOT NULL,

  CONSTRAINT "ApiVariableExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiExecution" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "environmentId" TEXT,
  "environmentName" TEXT,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "responseStatus" INTEGER,
  "assertionResults" JSONB NOT NULL,
  "extractedVariables" JSONB NOT NULL,
  "responseSnapshot" JSONB,
  "reportSummary" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApiExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiSecret_projectId_createdAt_idx" ON "ApiSecret"("projectId", "createdAt");
CREATE INDEX "ApiEnvironment_projectId_createdAt_idx" ON "ApiEnvironment"("projectId", "createdAt");
CREATE INDEX "ApiTestCase_projectId_createdAt_idx" ON "ApiTestCase"("projectId", "createdAt");
CREATE UNIQUE INDEX "ApiAssertion_caseId_order_key" ON "ApiAssertion"("caseId", "order");
CREATE INDEX "ApiAssertion_caseId_order_idx" ON "ApiAssertion"("caseId", "order");
CREATE UNIQUE INDEX "ApiVariableExtraction_caseId_order_key" ON "ApiVariableExtraction"("caseId", "order");
CREATE INDEX "ApiVariableExtraction_caseId_order_idx" ON "ApiVariableExtraction"("caseId", "order");
CREATE INDEX "ApiExecution_projectId_startedAt_idx" ON "ApiExecution"("projectId", "startedAt");
CREATE INDEX "ApiExecution_caseId_startedAt_idx" ON "ApiExecution"("caseId", "startedAt");
CREATE INDEX "ApiExecution_environmentId_startedAt_idx" ON "ApiExecution"("environmentId", "startedAt");

ALTER TABLE "ApiSecret" ADD CONSTRAINT "ApiSecret_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiSecret" ADD CONSTRAINT "ApiSecret_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiEnvironment" ADD CONSTRAINT "ApiEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiEnvironment" ADD CONSTRAINT "ApiEnvironment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiTestCase" ADD CONSTRAINT "ApiTestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiTestCase" ADD CONSTRAINT "ApiTestCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiAssertion" ADD CONSTRAINT "ApiAssertion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ApiTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiVariableExtraction" ADD CONSTRAINT "ApiVariableExtraction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ApiTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ApiTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "ApiEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiExecution" ADD CONSTRAINT "ApiExecution_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
