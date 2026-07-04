-- Harden MCP admin as the single approval surface and preserve legacy history.

-- Existing call rows were previously keyed only by AI run. Backfill projectId so
-- project-scoped history queries keep showing prior calls after mcp-admin lands.
UPDATE "McpToolCall" AS call
SET "projectId" = run."projectId"
FROM "AiWorkflowRun" AS run
WHERE call."runId" = run."id"
  AND call."projectId" IS NULL;

-- Existing allowlist rows become mcp-admin registry rows so invocation policy can
-- require both the derivative allowlist and an auditable approval lifecycle.
INSERT INTO "McpTool" (
    "id",
    "projectId",
    "toolName",
    "serverRef",
    "description",
    "status",
    "proposedBy",
    "reviewedBy",
    "approvedBy",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-mcp-tool-' || md5("projectId" || '|' || "toolName" || '|' || "serverRef"),
    "projectId",
    "toolName",
    "serverRef",
    'Backfilled from legacy MCP allowlist during mcp-admin migration.',
    CASE WHEN "approved" THEN 'approved'::"McpToolStatus" ELSE 'revoked'::"McpToolStatus" END,
    COALESCE("approvedBy", 'legacy-migration'),
    CASE WHEN "approved" THEN COALESCE("approvedBy", 'legacy-migration') ELSE NULL END,
    CASE WHEN "approved" THEN "approvedBy" ELSE NULL END,
    "createdAt",
    "updatedAt"
FROM "McpToolAllowlist"
ON CONFLICT ("projectId", "toolName", "serverRef") DO NOTHING;

INSERT INTO "McpToolAction" (
    "id",
    "toolId",
    "projectId",
    "action",
    "fromStatus",
    "toStatus",
    "actorId",
    "metadata",
    "createdAt"
)
SELECT
    'legacy-mcp-tool-action-' || md5(tool."id"),
    tool."id",
    tool."projectId",
    CASE WHEN allowlist."approved" THEN 'backfill-approve' ELSE 'backfill-revoke' END,
    NULL,
    tool."status",
    COALESCE(allowlist."approvedBy", 'legacy-migration'),
    jsonb_build_object('source', 'legacy_mcp_allowlist_backfill'),
    allowlist."updatedAt"
FROM "McpTool" AS tool
JOIN "McpToolAllowlist" AS allowlist
  ON allowlist."projectId" = tool."projectId"
 AND allowlist."toolName" = tool."toolName"
 AND allowlist."serverRef" = tool."serverRef"
WHERE NOT EXISTS (
    SELECT 1
    FROM "McpToolAction" AS existing
    WHERE existing."toolId" = tool."id"
      AND existing."action" IN ('backfill-approve', 'backfill-revoke')
);
