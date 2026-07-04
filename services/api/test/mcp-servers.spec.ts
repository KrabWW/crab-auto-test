import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { McpServersService } from "../src/modules/mcp/mcp-servers.service";

function makeService(prisma: Record<string, unknown>) {
  return new McpServersService(prisma as never, { record: vi.fn() } as never);
}

describe("mcp servers", () => {
  it("create rejects missing name and url", async () => {
    const svc = makeService({});
    await expect(svc.create("p", "u", { name: "", url: "https://x" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create("p", "u", { name: "ok", url: "" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects non-http urls", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "ok", url: "ftp://example.com" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects unsupported transports", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "ok", url: "https://x", transport: "ws" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create persists server config", async () => {
    const created = {
      id: "srv-1",
      projectId: "p",
      name: "playwright",
      url: "https://example.com/mcp",
      transport: "streamable-http",
      headers: null,
      isActive: true,
      lastSyncAt: null,
      syncError: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = makeService({
      mcpServerConfig: { create: vi.fn().mockResolvedValue(created) },
    });
    const dto = await svc.create("p", "u", { name: "playwright", url: "https://example.com/mcp" });
    expect(dto.id).toBe("srv-1");
    expect(dto.transport).toBe("streamable-http");
  });

  it("get returns 404 for cross-project servers", async () => {
    const svc = makeService({
      mcpServerConfig: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.get("p", "srv-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("sync records connection failure and returns empty tools", async () => {
    const server = {
      id: "srv-1",
      projectId: "p",
      name: "playwright",
      url: "https://example.invalid/mcp",
      transport: "streamable-http",
      headers: null,
      isActive: true,
      lastSyncAt: null,
      syncError: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updateFn = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...server, ...data } as never),
    );
    const svc = makeService({
      mcpServerConfig: {
        findFirst: vi.fn().mockResolvedValue(server),
        update: updateFn,
      },
    });
    const result = await svc.sync("p", "srv-1", "u");
    expect(result.syncedTools).toEqual([]);
    expect(result.server.syncError).toBeTruthy();
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncError: expect.any(String) }),
      }),
    );
  });
});
