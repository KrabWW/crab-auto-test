-- Phase 3: MCP admin governance.

CREATE TYPE "McpToolStatus" AS ENUM ('proposed', 'reviewed', 'approved', 'revoked');

CREATE TABLE "McpTool" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "serverRef" TEXT NOT NULL,
    "description" TEXT,
    "status" "McpToolStatus" NOT NULL DEFAULT 'proposed',
    "proposedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "McpTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "McpToolAction" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "McpToolStatus",
    "toStatus" "McpToolStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpToolAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "McpToolCall" ADD COLUMN "projectId" TEXT;

CREATE UNIQUE INDEX "McpTool_projectId_toolName_serverRef_key" ON "McpTool"("projectId", "toolName", "serverRef");
CREATE INDEX "McpTool_projectId_status_idx" ON "McpTool"("projectId", "status");
CREATE INDEX "McpToolAction_toolId_createdAt_idx" ON "McpToolAction"("toolId", "createdAt");
CREATE INDEX "McpToolAction_projectId_createdAt_idx" ON "McpToolAction"("projectId", "createdAt");
CREATE INDEX "McpToolCall_projectId_startedAt_idx" ON "McpToolCall"("projectId", "startedAt");
CREATE INDEX "McpToolCall_projectId_toolName_serverRef_idx" ON "McpToolCall"("projectId", "toolName", "serverRef");

ALTER TABLE "McpTool" ADD CONSTRAINT "McpTool_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpToolAction" ADD CONSTRAINT "McpToolAction_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "McpTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpToolAction" ADD CONSTRAINT "McpToolAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
