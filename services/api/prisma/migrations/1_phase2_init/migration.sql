-- Phase 2 migration: KB/RAG + Skills + MCP.
-- Generated incrementally from the 0_init baseline via prisma migrate diff,
-- PLUS raw SQL for pgvector (R9: Prisma has no native `vector` type).

-- R9: pgvector extension + raw vector table (managed outside Prisma).
CREATE EXTENSION IF NOT EXISTS "vector";

-- Raw table holding the actual embeddings; EmbeddingRef.vectorRef points here.
CREATE TABLE IF NOT EXISTS "embedding_vector" (
  "id" TEXT PRIMARY KEY,
  "chunk_id" TEXT UNIQUE NOT NULL,
  "embedding" vector(1536) NOT NULL
);

-- HNSW index for ANN retrieval (fallback to ivfflat if hnsw unsupported).
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS "embedding_vector_embedding_hnsw_idx"
      ON "embedding_vector" USING hnsw ("embedding" vector_cosine_ops);
  EXCEPTION WHEN feature_not_supported THEN
    CREATE INDEX IF NOT EXISTS "embedding_vector_embedding_ivfflat_idx"
      ON "embedding_vector" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
  END;
END $$;

-- ─── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE "DocumentStatus" AS ENUM ('ingested', 'failed');
CREATE TYPE "SkillValidationStatus" AS ENUM ('unvalidated', 'valid', 'invalid');
CREATE TYPE "SkillInstallationState" AS ENUM ('installed', 'disabled', 'uninstalled');
CREATE TYPE "SkillInvocationStatus" AS ENUM ('success', 'failure', 'denied');
CREATE TYPE "McpToolCallStatus" AS ENUM ('success', 'failure', 'rejected');

-- ─── Knowledge / RAG ───────────────────────────────────────────────────────
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ingested',
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sourceMetadata" JSONB,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmbeddingRef" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "backend" TEXT NOT NULL,
    "vectorRef" TEXT NOT NULL,
    "dims" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmbeddingRef_pkey" PRIMARY KEY ("id")
);

-- ─── Skills ────────────────────────────────────────────────────────────────
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "compatibility" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "entryPoints" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "validationStatus" "SkillValidationStatus" NOT NULL DEFAULT 'unvalidated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillInstallation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "skillId" TEXT NOT NULL,
    "state" "SkillInstallationState" NOT NULL DEFAULT 'installed',
    "activatedPermissions" JSONB,
    "previousVersionId" TEXT,
    "installedBy" TEXT NOT NULL,
    "installedChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillInvocation" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "runId" TEXT,
    "workerJobRef" TEXT,
    "adapter" TEXT NOT NULL,
    "permissionsUsed" JSONB,
    "argsRedacted" JSONB,
    "resultMeta" JSONB,
    "status" "SkillInvocationStatus" NOT NULL,
    "invokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillInvocation_pkey" PRIMARY KEY ("id")
);

-- ─── MCP ───────────────────────────────────────────────────────────────────
CREATE TABLE "McpToolAllowlist" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "serverRef" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "McpToolAllowlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "McpToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "toolName" TEXT NOT NULL,
    "serverRef" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "argsRedacted" JSONB,
    "resultMeta" JSONB,
    "status" "McpToolCallStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "McpToolCall_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX "KnowledgeBase_projectId_idx" ON "KnowledgeBase"("projectId");
CREATE INDEX "Document_knowledgeBaseId_status_idx" ON "Document"("knowledgeBaseId", "status");
CREATE INDEX "DocumentChunk_documentId_order_idx" ON "DocumentChunk"("documentId", "order");
CREATE UNIQUE INDEX "EmbeddingRef_chunkId_key" ON "EmbeddingRef"("chunkId");
CREATE INDEX "EmbeddingRef_backend_idx" ON "EmbeddingRef"("backend");
CREATE INDEX "Skill_name_idx" ON "Skill"("name");
CREATE UNIQUE INDEX "Skill_name_version_key" ON "Skill"("name", "version");
CREATE INDEX "SkillInstallation_projectId_state_idx" ON "SkillInstallation"("projectId", "state");
CREATE INDEX "SkillInvocation_installationId_invokedAt_idx" ON "SkillInvocation"("installationId", "invokedAt");
CREATE INDEX "McpToolAllowlist_projectId_approved_idx" ON "McpToolAllowlist"("projectId", "approved");
CREATE UNIQUE INDEX "McpToolAllowlist_projectId_toolName_serverRef_key" ON "McpToolAllowlist"("projectId", "toolName", "serverRef");
CREATE INDEX "McpToolCall_runId_status_idx" ON "McpToolCall"("runId", "status");
CREATE INDEX "McpToolCall_toolName_idx" ON "McpToolCall"("toolName");

-- ─── Foreign keys ──────────────────────────────────────────────────────────
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmbeddingRef" ADD CONSTRAINT "EmbeddingRef_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillInstallation" ADD CONSTRAINT "SkillInstallation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillInstallation" ADD CONSTRAINT "SkillInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillInstallation" ADD CONSTRAINT "SkillInstallation_installedBy_fkey" FOREIGN KEY ("installedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillInvocation" ADD CONSTRAINT "SkillInvocation_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "SkillInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpToolAllowlist" ADD CONSTRAINT "McpToolAllowlist_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
