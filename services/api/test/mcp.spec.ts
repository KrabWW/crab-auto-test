import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { McpService } from "../src/modules/mcp/mcp.service";

function makeService(prisma: Record<string, unknown>) {
  return new McpService(prisma as never, { record: vi.fn() } as never);
}

function tool(overrides: Record<string, unknown> = {}) {
  return {
    id: "tool-1",
    projectId: "project-a",
    toolName: "search_docs",
    serverRef: "http://mcp.local/mcp",
    description: "Search project docs",
    status: "proposed",
    proposedBy: "user-a",
    reviewedBy: null,
    approvedBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("mcp-admin governance", () => {
  it("registers project-scoped tool candidates with an action trail", async () => {
    const created = tool();
    const actionCreate = vi.fn();
    const svc = makeService({
      mcpTool: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn((cb) =>
        cb({
          mcpTool: { create: vi.fn().mockResolvedValue(created) },
          mcpToolAction: { create: actionCreate },
        }),
      ),
    });

    const dto = await svc.proposeTool("project-a", "user-a", {
      toolName: " search_docs ",
      serverRef: "http://mcp.local/mcp",
      description: "Search project docs",
    });

    expect(dto).toMatchObject({ toolName: "search_docs", projectId: "project-a", status: "proposed" });
    expect(actionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-a",
          action: "propose",
          toStatus: "proposed",
          actorId: "user-a",
        }),
      }),
    );
  });

  it("blocks non-owner approval writes", async () => {
    const svc = makeService({
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "member" }) },
    });

    await expect(svc.approveTool("project-a", "tool-1", "user-a")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("approves only reviewed tools and upserts the allowlist source of truth", async () => {
    const allowlistUpsert = vi.fn();
    const actionCreate = vi.fn();
    const svc = makeService({
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) },
      mcpTool: { findFirst: vi.fn().mockResolvedValue(tool({ status: "reviewed", reviewedBy: "owner-a" })) },
      $transaction: vi.fn((cb) =>
        cb({
          mcpTool: { update: vi.fn().mockResolvedValue(tool({ status: "approved", approvedBy: "owner-a" })) },
          mcpToolAction: { create: actionCreate },
          mcpToolAllowlist: { upsert: allowlistUpsert },
        }),
      ),
    });

    const dto = await svc.approveTool("project-a", "tool-1", "owner-a");

    expect(dto.status).toBe("approved");
    expect(dto.allowlisted).toBe(true);
    expect(allowlistUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ projectId: "project-a", approved: true, approvedBy: "owner-a" }),
        update: { approved: true, approvedBy: "owner-a" },
      }),
    );
    expect(actionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "approve", fromStatus: "reviewed", toStatus: "approved" }),
      }),
    );
  });

  it("rejects approving proposed tools before review", async () => {
    const svc = makeService({
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) },
      mcpTool: { findFirst: vi.fn().mockResolvedValue(tool({ status: "proposed" })) },
    });

    await expect(svc.approveTool("project-a", "tool-1", "owner-a")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("mcp-admin call traces", () => {
  it("records non-allowlisted test calls as rejected with redacted args", async () => {
    const callCreate = vi.fn();
    const svc = makeService({
      mcpTool: {
        findFirst: vi.fn().mockResolvedValue(tool({ status: "proposed" })),
        findUnique: vi.fn().mockResolvedValue(tool({ status: "proposed" })),
      },
      mcpToolAllowlist: { findUnique: vi.fn().mockResolvedValue(null) },
      mcpToolCall: { create: callCreate },
    });

    const result = await svc.testTool("project-a", "tool-1", "user-a", {
      args: { query: "checkout", token: "secret-token", nested: { password: "pw" } },
    });

    expect(result).toMatchObject({ approved: false, status: "rejected" });
    expect(callCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-a",
          toolName: "search_docs",
          approved: false,
          status: "rejected",
          argsRedacted: expect.objectContaining({
            query: "checkout",
            token: "[REDACTED]",
            nested: { password: "[REDACTED]" },
          }),
        }),
      }),
    );
  });

  it("rejects hidden allowlist rows without an approved mcp-admin registry row", async () => {
    const callCreate = vi.fn();
    const svc = makeService({
      mcpTool: { findUnique: vi.fn().mockResolvedValue(null) },
      mcpToolAllowlist: { findUnique: vi.fn().mockResolvedValue({ approved: true }) },
      mcpToolCall: { create: callCreate },
    });

    const result = await svc.invokeTool({
      projectId: "project-a",
      toolName: "search_docs",
      serverRef: "http://mcp.local/mcp",
      args: { query: "checkout" },
      actorId: "user-a",
    });

    expect(result).toMatchObject({ approved: false, status: "rejected" });
    expect(callCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-a",
          approved: false,
          status: "rejected",
          resultMeta: { reason: "not approved by mcp-admin policy" },
        }),
      }),
    );
  });

  it("filters run call history by project", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = makeService({ mcpToolCall: { findMany } });

    await svc.listCalls("project-a", "run-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: "project-a", runId: "run-1" },
      orderBy: { startedAt: "asc" },
    });
  });

  it("returns per-tool history without cross-project calls", async () => {
    const callFindMany = vi.fn().mockResolvedValue([]);
    const svc = makeService({
      mcpTool: { findFirst: vi.fn().mockResolvedValue(tool({ status: "approved" })) },
      mcpToolAction: { findMany: vi.fn().mockResolvedValue([]) },
      mcpToolCall: { findMany: callFindMany },
      mcpToolAllowlist: { findUnique: vi.fn().mockResolvedValue({ approved: true }) },
    });

    const history = await svc.toolHistory("project-a", "tool-1");

    expect(history.tool.allowlisted).toBe(true);
    expect(callFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-a", toolName: "search_docs", serverRef: "http://mcp.local/mcp" },
      }),
    );
  });
});
