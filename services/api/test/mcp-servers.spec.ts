import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { McpServersService } from "../src/modules/mcp/mcp-servers.service";

// Stub the MCP SDK Client before any service is constructed so `buildClient`
// never touches the real network. Per-test overrides drive the behaviour.
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    constructor(public config: unknown) {}
    async connect() {}
    async listTools() {
      return { tools: [] };
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    constructor(public url: unknown) {}
  },
}));

function makeService(
  prisma: Record<string, unknown>,
  overrides: Partial<{ listTools: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = {},
) {
  const service = new McpServersService(prisma as never, { record: vi.fn() } as never);
  if (overrides.listTools || overrides.connect) {
    (service as unknown as { buildClient: () => unknown }).buildClient = vi.fn(async () => {
      if (overrides.connect?.mockImplementation) {
        await Promise.resolve(overrides.connect());
      }
      return {
        listTools: overrides.listTools ?? vi.fn().mockResolvedValue({ tools: [] }),
      };
    });
  }
  return service;
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
    const connect = vi.fn().mockImplementation(() => {
      throw new Error("Connection refused");
    });
    const svc = makeService(
      {
        mcpServerConfig: {
          findFirst: vi.fn().mockResolvedValue(server),
          update: updateFn,
        },
      },
      { connect },
    );
    const result = await svc.sync("p", "srv-1", "u");
    expect(result.syncedTools).toEqual([]);
    expect(result.server.syncError).toBe("Connection refused");
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncError: "Connection refused" }),
      }),
    );
  });

  it("sync persists tools when listTools returns new entries", async () => {
    const server = {
      id: "srv-2",
      projectId: "p",
      name: "core",
      url: "https://mcp.local/sse",
      transport: "streamable-http",
      headers: null,
      isActive: true,
      lastSyncAt: null,
      syncError: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const findFirstTool = vi.fn().mockResolvedValue(null);
    const createTool = vi.fn().mockResolvedValue({});
    const updateFn = vi.fn().mockResolvedValue({ ...server, lastSyncAt: new Date() });
    const listTools = vi
      .fn()
      .mockResolvedValue({ tools: [{ name: "search", description: "search tool" }] });
    const svc = makeService(
      {
        mcpServerConfig: { findFirst: vi.fn().mockResolvedValue(server), update: updateFn },
        mcpTool: { findFirst: findFirstTool, create: createTool },
      },
      { listTools },
    );
    const result = await svc.sync("p", "srv-2", "u");
    expect(result.syncedTools).toHaveLength(1);
    expect(result.syncedTools[0]!.toolName).toBe("search");
    expect(result.syncedTools[0]!.created).toBe(true);
    expect(createTool).toHaveBeenCalled();
  });
});
