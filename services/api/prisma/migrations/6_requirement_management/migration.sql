-- Phase 3: requirement management with versioned AI/test-case linkage.

CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequirementVersion" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequirementReviewEvent" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementReviewEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TestCase" ADD COLUMN "requirementVersionId" TEXT;
ALTER TABLE "AiWorkflowRun" ADD COLUMN "requirementVersionId" TEXT;

CREATE INDEX "Requirement_projectId_status_idx" ON "Requirement"("projectId", "status");
CREATE INDEX "Requirement_projectId_updatedAt_idx" ON "Requirement"("projectId", "updatedAt");
CREATE UNIQUE INDEX "RequirementVersion_requirementId_version_key" ON "RequirementVersion"("requirementId", "version");
CREATE INDEX "RequirementVersion_projectId_status_idx" ON "RequirementVersion"("projectId", "status");
CREATE INDEX "RequirementReviewEvent_projectId_requirementId_createdAt_idx" ON "RequirementReviewEvent"("projectId", "requirementId", "createdAt");
CREATE INDEX "TestCase_requirementVersionId_idx" ON "TestCase"("requirementVersionId");
CREATE INDEX "AiWorkflowRun_requirementVersionId_idx" ON "AiWorkflowRun"("requirementVersionId");

ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequirementVersion" ADD CONSTRAINT "RequirementVersion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementVersion" ADD CONSTRAINT "RequirementVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementReviewEvent" ADD CONSTRAINT "RequirementReviewEvent_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementReviewEvent" ADD CONSTRAINT "RequirementReviewEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementReviewEvent" ADD CONSTRAINT "RequirementReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_requirementVersionId_fkey" FOREIGN KEY ("requirementVersionId") REFERENCES "RequirementVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRun" ADD CONSTRAINT "AiWorkflowRun_requirementVersionId_fkey" FOREIGN KEY ("requirementVersionId") REFERENCES "RequirementVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
