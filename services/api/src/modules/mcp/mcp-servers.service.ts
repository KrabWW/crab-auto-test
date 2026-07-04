import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateMcpServerRequest,
  McpServerConfigDto,
  McpServerSyncResult,
  UpdateMcpServerRequest,
} from "@crab/shared-types";

/**
 * Race a promise against a timeout. Rejects with `message` if the timeout
 * fires before the underlying promise settles. Used to bound MCP server
 * network calls so a silent server cannot hang sync flows.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const ALLOWED_TRANSPORTS = new Set(["streamable-http", "http", "sse"]);

interface ServerRow {
  id: string;
  projectId: string;
  name: string;
  url: string;
  transport: string;
  headers: unknown;
  isActive: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class McpServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<McpServerConfigDto[]> {
    const rows = await this.prisma.mcpServerConfig.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row as unknown as ServerRow));
  }

  async get(projectId: string, serverId: string): Promise<McpServerConfigDto> {
    return this.toDto(await this.findServer(projectId, serverId));
  }

  async create(
    projectId: string,
    actorId: string,
    req: CreateMcpServerRequest,
  ): Promise<McpServerConfigDto> {
    const name = req.name?.trim();
    const url = req.url?.trim();
    if (!name) throw new BadRequestException("Server name is required");
    if (!url) throw new BadRequestException("Server URL is required");
    this.assertHttpUrl(url);
    const transport = req.transport?.trim() || "streamable-http";
    if (!ALLOWED_TRANSPORTS.has(transport)) {
      throw new BadRequestException(`Unsupported transport: ${transport}`);
    }
    const headers = req.headers ?? null;

    const created = await this.prisma.mcpServerConfig.create({
      data: {
        projectId,
        name,
        url,
        transport,
        headers: headers as never,
        isActive: true,
        createdBy: actorId,
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "mcp-server.create",
      targetType: "mcp-server-config",
      targetId: created.id,
      outcome: "success",
      metadata: { name, url, transport },
    });
    return this.toDto(created as unknown as ServerRow);
  }

  async update(
    projectId: string,
    serverId: string,
    actorId: string,
    req: UpdateMcpServerRequest,
  ): Promise<McpServerConfigDto> {
    await this.findServer(projectId, serverId);
    if (req.url !== undefined) this.assertHttpUrl(req.url);
    if (req.transport !== undefined && !ALLOWED_TRANSPORTS.has(req.transport)) {
      throw new BadRequestException(`Unsupported transport: ${req.transport}`);
    }
    const updated = await this.prisma.mcpServerConfig.update({
      where: { id: serverId },
      data: {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(req.url !== undefined ? { url: req.url } : {}),
        ...(req.transport !== undefined ? { transport: req.transport } : {}),
        ...(req.headers !== undefined ? { headers: req.headers as never } : {}),
        ...(req.isActive !== undefined ? { isActive: req.isActive } : {}),
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "mcp-server.update",
      targetType: "mcp-server-config",
      targetId: serverId,
      outcome: "success",
    });
    return this.toDto(updated as unknown as ServerRow);
  }

  async delete(projectId: string, serverId: string, actorId: string): Promise<void> {
    await this.findServer(projectId, serverId);
    await this.prisma.mcpServerConfig.delete({ where: { id: serverId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "mcp-server.delete",
      targetType: "mcp-server-config",
      targetId: serverId,
      outcome: "success",
    });
  }

  /**
   * Connect to the remote MCP server, list its tools, and persist any unknown
   * tool as a proposed McpTool for project owners to review. Returns the full
   * tool list so callers can see what was found regardless of create status.
   */
  async sync(projectId: string, serverId: string, actorId: string): Promise<McpServerSyncResult> {
    const server = await this.findServer(projectId, serverId);
    let client: Client;
    try {
      client = await this.buildClient(server.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      const failed = await this.prisma.mcpServerConfig.update({
        where: { id: serverId },
        data: { syncError: message },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "mcp-server.sync",
        targetType: "mcp-server-config",
        targetId: serverId,
        outcome: "failure",
        metadata: { error: message },
      });
      return {
        server: this.toDto(failed as unknown as ServerRow),
        syncedTools: [],
      };
    }

    try {
      const toolsResponse = await withTimeout(
        client.listTools(),
        15_000,
        "MCP server listTools timed out (15s)",
      );
      const tools = toolsResponse.tools ?? [];
      const syncedTools: McpServerSyncResult["syncedTools"] = [];

      for (const tool of tools) {
        const toolName = String(tool.name ?? "").trim();
        if (!toolName) continue;
        const existing = await this.prisma.mcpTool.findFirst({
          where: { projectId, toolName, serverRef: server.url },
          select: { id: true },
        });
        if (!existing) {
          await this.prisma.mcpTool.create({
            data: {
              projectId,
              toolName,
              serverRef: server.url,
              description: typeof tool.description === "string" ? tool.description : null,
              proposedBy: actorId,
            },
          });
        }
        syncedTools.push({
          toolName,
          ...(typeof tool.description === "string" && tool.description
            ? { description: tool.description }
            : {}),
          created: !existing,
        });
      }

      const updated = await this.prisma.mcpServerConfig.update({
        where: { id: serverId },
        data: { lastSyncAt: new Date(), syncError: null },
      });

      await this.audit.record({
        actorId,
        projectId,
        action: "mcp-server.sync",
        targetType: "mcp-server-config",
        targetId: serverId,
        outcome: "success",
        metadata: { toolCount: syncedTools.length, newCount: syncedTools.filter((t) => t.created).length },
      });

      return {
        server: this.toDto(updated as unknown as ServerRow),
        syncedTools,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool listing failed";
      const failed = await this.prisma.mcpServerConfig.update({
        where: { id: serverId },
        data: { syncError: message },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "mcp-server.sync",
        targetType: "mcp-server-config",
        targetId: serverId,
        outcome: "failure",
        metadata: { error: message },
      });
      return {
        server: this.toDto(failed as unknown as ServerRow),
        syncedTools: [],
      };
    }
  }

  private async findServer(projectId: string, serverId: string): Promise<ServerRow> {
    const row = await this.prisma.mcpServerConfig.findFirst({
      where: { id: serverId, projectId },
    });
    if (!row) throw new NotFoundException("MCP server config not found");
    return row as unknown as ServerRow;
  }

  private async buildClient(serverUrl: string): Promise<Client> {
    const client = new Client({ name: "crab-api", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    // Bound connect attempt so a silent/unreachable MCP server cannot hang the
    // sync flow indefinitely. 10s matches the report's MCP UX hardening note.
    await withTimeout(client.connect(transport), 10_000, "MCP server connect timed out (10s)");
    return client;
  }

  private assertHttpUrl(value: string) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(`Server URL is invalid: ${value}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException("MCP server URL must use http(s)");
    }
  }

  private toDto(row: ServerRow): McpServerConfigDto {
    const headers = (row.headers as Record<string, string> | null) ?? undefined;
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      url: row.url,
      transport: row.transport,
      ...(headers ? { headers } : {}),
      isActive: row.isActive,
      ...(row.lastSyncAt ? { lastSyncAt: row.lastSyncAt.toISOString() } : {}),
      ...(row.syncError ? { syncError: row.syncError } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
