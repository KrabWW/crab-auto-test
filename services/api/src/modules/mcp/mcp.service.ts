import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { redact } from "../../common/redact";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  CreateMcpToolRequest,
  McpToolActionDto,
  McpToolCallDto,
  McpToolCallResultDto,
  McpToolDto,
  McpToolHistoryDto,
  McpToolStatus,
  TestMcpToolRequest,
} from "@crab/shared-types";

type McpToolRow = {
  id: string;
  projectId: string;
  toolName: string;
  serverRef: string;
  description: string | null;
  status: McpToolStatus;
  proposedBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type McpToolActionRow = {
  id: string;
  toolId: string;
  projectId: string;
  action: string;
  fromStatus: McpToolStatus | null;
  toStatus: McpToolStatus;
  actorId: string;
  metadata: unknown;
  createdAt: Date;
};

type McpToolCallRow = {
  id: string;
  projectId: string | null;
  runId: string | null;
  toolName: string;
  serverRef: string;
  approved: boolean;
  argsRedacted: unknown;
  resultMeta: unknown;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
};

const STATUSES = new Set<McpToolStatus>(["proposed", "reviewed", "approved", "revoked"]);

/**
 * backend-ai-orchestration.3 + mcp-admin:
 * MCP clients are backend-managed and project scoped. Invocation requires both
 * an approved allowlist row and an approved mcp-admin registry row so approvals
 * cannot bypass the review/action history.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  /** Cached MCP clients per serverRef (backend-managed, lazily connected). */
  private readonly clients = new Map<string, Client>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listTools(projectId: string): Promise<McpToolDto[]> {
    const [tools, allowlist] = await Promise.all([
      this.prisma.mcpTool.findMany({
        where: { projectId },
        orderBy: [{ updatedAt: "desc" }, { toolName: "asc" }],
      }),
      this.prisma.mcpToolAllowlist.findMany({ where: { projectId } }),
    ]);
    const allowed = new Set(
      allowlist
        .filter((entry) => entry.approved)
        .map((entry) => this.toolKey(entry.toolName, entry.serverRef)),
    );
    return tools.map((tool) => this.toToolDto(tool, allowed.has(this.toolKey(tool.toolName, tool.serverRef))));
  }

  async proposeTool(projectId: string, actorId: string, req: CreateMcpToolRequest): Promise<McpToolDto> {
    const input = this.normalizeToolInput(req);
    const existing = await this.prisma.mcpTool.findUnique({
      where: { projectId_toolName_serverRef: { projectId, toolName: input.toolName, serverRef: input.serverRef } },
    });
    if (existing && existing.status !== "revoked") {
      throw new BadRequestException("MCP tool already exists for this project");
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        const updated = await tx.mcpTool.update({
          where: { id: existing.id },
          data: {
            description: input.description,
            status: "proposed",
            proposedBy: actorId,
            reviewedBy: null,
            approvedBy: null,
          },
        });
        await tx.mcpToolAction.create({
          data: {
            toolId: updated.id,
            projectId,
            action: "propose",
            fromStatus: existing.status,
            toStatus: "proposed",
            actorId,
          },
        });
        return updated;
      }

      const created = await tx.mcpTool.create({
        data: {
          projectId,
          toolName: input.toolName,
          serverRef: input.serverRef,
          description: input.description,
          status: "proposed",
          proposedBy: actorId,
        },
      });
      await tx.mcpToolAction.create({
        data: {
          toolId: created.id,
          projectId,
          action: "propose",
          fromStatus: null,
          toStatus: "proposed",
          actorId,
        },
      });
      return created;
    });

    await this.recordAdminAudit(actorId, projectId, "mcp.admin.propose", saved.id, {
      toolName: saved.toolName,
      serverRef: saved.serverRef,
    });
    return this.toToolDto(saved, false);
  }

  async reviewTool(projectId: string, toolId: string, actorId: string): Promise<McpToolDto> {
    await this.ensureOwner(projectId, actorId);
    const tool = await this.findTool(projectId, toolId);
    if (tool.status === "reviewed") return this.toToolDto(tool, await this.isAllowlisted(projectId, tool));
    if (tool.status !== "proposed") throw new BadRequestException("Only proposed MCP tools can be reviewed");
    const updated = await this.transitionTool(projectId, tool, actorId, "review", "reviewed", {
      reviewedBy: actorId,
    });
    return this.toToolDto(updated, await this.isAllowlisted(projectId, updated));
  }

  async approveTool(projectId: string, toolId: string, actorId: string): Promise<McpToolDto> {
    await this.ensureOwner(projectId, actorId);
    const tool = await this.findTool(projectId, toolId);
    if (tool.status === "approved") return this.toToolDto(tool, true);
    if (tool.status !== "reviewed") throw new BadRequestException("Only reviewed MCP tools can be approved");

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mcpTool.update({
        where: { id: tool.id },
        data: { status: "approved", approvedBy: actorId },
      });
      await tx.mcpToolAction.create({
        data: {
          toolId: tool.id,
          projectId,
          action: "approve",
          fromStatus: tool.status,
          toStatus: "approved",
          actorId,
        },
      });
      await tx.mcpToolAllowlist.upsert({
        where: {
          projectId_toolName_serverRef: {
            projectId,
            toolName: tool.toolName,
            serverRef: tool.serverRef,
          },
        },
        create: {
          projectId,
          toolName: tool.toolName,
          serverRef: tool.serverRef,
          approved: true,
          approvedBy: actorId,
        },
        update: { approved: true, approvedBy: actorId },
      });
      return row;
    });
    await this.recordAdminAudit(actorId, projectId, "mcp.admin.approve", tool.id, {
      toolName: tool.toolName,
      serverRef: tool.serverRef,
    });
    return this.toToolDto(updated, true);
  }

  async revokeTool(projectId: string, toolId: string, actorId: string): Promise<McpToolDto> {
    await this.ensureOwner(projectId, actorId);
    const tool = await this.findTool(projectId, toolId);
    if (tool.status === "revoked") return this.toToolDto(tool, false);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mcpTool.update({
        where: { id: tool.id },
        data: { status: "revoked", approvedBy: null },
      });
      await tx.mcpToolAction.create({
        data: {
          toolId: tool.id,
          projectId,
          action: "revoke",
          fromStatus: tool.status,
          toStatus: "revoked",
          actorId,
        },
      });
      await tx.mcpToolAllowlist.upsert({
        where: {
          projectId_toolName_serverRef: {
            projectId,
            toolName: tool.toolName,
            serverRef: tool.serverRef,
          },
        },
        create: {
          projectId,
          toolName: tool.toolName,
          serverRef: tool.serverRef,
          approved: false,
          approvedBy: actorId,
        },
        update: { approved: false, approvedBy: actorId },
      });
      return row;
    });
    await this.recordAdminAudit(actorId, projectId, "mcp.admin.revoke", tool.id, {
      toolName: tool.toolName,
      serverRef: tool.serverRef,
    });
    return this.toToolDto(updated, false);
  }

  async testTool(
    projectId: string,
    toolId: string,
    actorId: string,
    req: TestMcpToolRequest,
  ): Promise<McpToolCallResultDto> {
    const tool = await this.findTool(projectId, toolId);
    return this.invokeTool({
      projectId,
      runId: req.runId,
      toolName: tool.toolName,
      serverRef: tool.serverRef,
      args: req.args ?? {},
      actorId,
    });
  }

  async toolHistory(projectId: string, toolId: string): Promise<McpToolHistoryDto> {
    const tool = await this.findTool(projectId, toolId);
    const [actions, calls, allowlisted] = await Promise.all([
      this.prisma.mcpToolAction.findMany({
        where: { toolId: tool.id, projectId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.mcpToolCall.findMany({
        where: { projectId, toolName: tool.toolName, serverRef: tool.serverRef },
        orderBy: { startedAt: "desc" },
      }),
      this.isAllowlisted(projectId, tool),
    ]);
    return {
      tool: this.toToolDto(tool, allowlisted),
      actions: actions.map((action) => this.toActionDto(action)),
      calls: calls.map((call) => this.toCallDto(call)),
    };
  }

  /**
   * backend-ai-orchestration.3 + mcp-admin source of truth: invoke an MCP tool
   * ONLY if it has both an approved registry row and an approved allowlist row.
   * Records McpToolCall for both approved and rejected calls.
   */
  async invokeTool(input: {
    projectId: string;
    runId?: string;
    toolName: string;
    serverRef: string;
    args: Record<string, unknown>;
    actorId: string;
  }): Promise<McpToolCallResultDto> {
    const normalized = this.normalizeToolInput(input);
    const callInput = { ...input, toolName: normalized.toolName, serverRef: normalized.serverRef };
    const [allowlisted, registered] = await Promise.all([
      this.prisma.mcpToolAllowlist.findUnique({
        where: {
          projectId_toolName_serverRef: {
            projectId: input.projectId,
            toolName: normalized.toolName,
            serverRef: normalized.serverRef,
          },
        },
      }),
      this.prisma.mcpTool.findUnique({
        where: {
          projectId_toolName_serverRef: {
            projectId: input.projectId,
            toolName: normalized.toolName,
            serverRef: normalized.serverRef,
          },
        },
      }),
    ]);
    const approved = Boolean(allowlisted?.approved && registered?.status === "approved");

    if (!approved) {
      const resultMeta = { reason: "not approved by mcp-admin policy" };
      await this.recordCall({ ...callInput, approved: false, status: "rejected", resultMeta });
      return { approved: false, status: "rejected", resultMeta };
    }

    try {
      const client = await this.getClient(normalized.serverRef);
      const result = await client.callTool({
        name: normalized.toolName,
        arguments: input.args,
      });
      const resultMeta = { content: result.content, isError: result.isError ?? false } as Record<string, unknown>;
      const status = result.isError ? "failure" : "success";
      await this.recordCall({ ...callInput, approved: true, status, resultMeta });
      return { approved: true, status, resultMeta };
    } catch (err) {
      const resultMeta = { error: (err as Error).message };
      await this.recordCall({ ...callInput, approved: true, status: "failure", resultMeta });
      this.logger.warn(`MCP tool ${normalized.toolName} failed: ${(err as Error).message}`);
      return { approved: true, status: "failure", resultMeta };
    }
  }

  /** Query McpToolCall history for a project-scoped run. */
  async listCalls(projectId: string, runId: string): Promise<McpToolCallDto[]> {
    const rows = await this.prisma.mcpToolCall.findMany({
      where: { projectId, runId },
      orderBy: { startedAt: "asc" },
    });
    return rows.map((row) => this.toCallDto(row));
  }

  async listAllowlist(projectId: string) {
    return this.prisma.mcpToolAllowlist.findMany({ where: { projectId } });
  }

  private async transitionTool(
    projectId: string,
    tool: McpToolRow,
    actorId: string,
    action: string,
    toStatus: McpToolStatus,
    data: Partial<Pick<McpToolRow, "reviewedBy" | "approvedBy">>,
  ): Promise<McpToolRow> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mcpTool.update({
        where: { id: tool.id },
        data: { ...data, status: toStatus },
      });
      await tx.mcpToolAction.create({
        data: {
          toolId: tool.id,
          projectId,
          action,
          fromStatus: tool.status,
          toStatus,
          actorId,
        },
      });
      return row;
    });
    await this.recordAdminAudit(actorId, projectId, `mcp.admin.${action}`, tool.id, {
      toolName: tool.toolName,
      serverRef: tool.serverRef,
    });
    return updated;
  }

  private async findTool(projectId: string, toolId: string): Promise<McpToolRow> {
    const tool = await this.prisma.mcpTool.findFirst({ where: { id: toolId, projectId } });
    if (!tool) throw new NotFoundException("MCP tool not found");
    return tool;
  }

  private async ensureOwner(projectId: string, actorId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actorId } },
    });
    if (membership?.role !== "owner") {
      throw new ForbiddenException("Only project owners can manage MCP approvals");
    }
  }

  private async isAllowlisted(projectId: string, tool: Pick<McpToolRow, "toolName" | "serverRef">): Promise<boolean> {
    const allowlisted = await this.prisma.mcpToolAllowlist.findUnique({
      where: {
        projectId_toolName_serverRef: {
          projectId,
          toolName: tool.toolName,
          serverRef: tool.serverRef,
        },
      },
    });
    return Boolean(allowlisted?.approved);
  }

  private normalizeToolInput(input: {
    toolName: string;
    serverRef: string;
    description?: string;
  }): { toolName: string; serverRef: string; description?: string } {
    const toolName = input.toolName.trim();
    const serverRef = input.serverRef.trim();
    const description = input.description?.trim() || undefined;
    if (!toolName) throw new BadRequestException("MCP tool name is required");
    if (!serverRef) throw new BadRequestException("MCP server reference is required");
    let parsed: URL;
    try {
      parsed = new URL(serverRef);
    } catch {
      throw new BadRequestException("MCP server reference must be an HTTP URL");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new BadRequestException("MCP server reference must be an HTTP URL");
    }
    return { toolName, serverRef: parsed.toString(), description };
  }

  private async getClient(serverRef: string): Promise<Client> {
    let client = this.clients.get(serverRef);
    if (client) return client;
    client = new Client({ name: "crab-api", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(serverRef));
    await client.connect(transport);
    this.clients.set(serverRef, client);
    return client;
  }

  private async recordCall(input: {
    projectId: string;
    runId?: string;
    toolName: string;
    serverRef: string;
    args: Record<string, unknown>;
    approved: boolean;
    status: "success" | "failure" | "rejected";
    resultMeta: Record<string, unknown>;
    actorId: string;
  }) {
    await this.prisma.mcpToolCall.create({
      data: {
        projectId: input.projectId,
        runId: input.runId,
        toolName: input.toolName,
        serverRef: input.serverRef,
        approved: input.approved,
        argsRedacted: redact(input.args) as object,
        resultMeta: redact(input.resultMeta) as object,
        status: input.status,
        finishedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: input.actorId,
      projectId: input.projectId,
      action: `mcp.call.${input.status}`,
      targetType: "mcp-tool",
      targetId: `${input.serverRef}/${input.toolName}`,
      outcome: input.status === "success" ? "success" : "failure",
      metadata: { approved: input.approved },
    });
  }

  private async recordAdminAudit(
    actorId: string,
    projectId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.audit.record({
      actorId,
      projectId,
      action,
      targetType: "mcp-tool",
      targetId,
      outcome: "success",
      metadata: redact(metadata) as Record<string, unknown>,
    });
  }

  private toolKey(toolName: string, serverRef: string): string {
    return `${serverRef}\u0000${toolName}`;
  }

  private toToolDto(row: McpToolRow, allowlisted: boolean): McpToolDto {
    const status = toMcpToolStatus(row.status);
    return {
      id: row.id,
      projectId: row.projectId,
      toolName: row.toolName,
      serverRef: row.serverRef,
      description: row.description ?? undefined,
      status,
      allowlisted,
      proposedBy: row.proposedBy,
      reviewedBy: row.reviewedBy ?? undefined,
      approvedBy: row.approvedBy ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toActionDto(row: McpToolActionRow): McpToolActionDto {
    return {
      id: row.id,
      toolId: row.toolId,
      projectId: row.projectId,
      action: row.action,
      fromStatus: row.fromStatus ? toMcpToolStatus(row.fromStatus) : undefined,
      toStatus: toMcpToolStatus(row.toStatus),
      actorId: row.actorId,
      metadata: asRecord(row.metadata),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toCallDto(row: McpToolCallRow): McpToolCallDto {
    return {
      id: row.id,
      projectId: row.projectId ?? undefined,
      runId: row.runId ?? undefined,
      toolName: row.toolName,
      serverRef: row.serverRef,
      approved: row.approved,
      argsRedacted: asRecord(row.argsRedacted),
      resultMeta: asRecord(row.resultMeta),
      status: row.status as McpToolCallDto["status"],
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString(),
    };
  }
}

function toMcpToolStatus(value: string): McpToolStatus {
  if (!STATUSES.has(value as McpToolStatus)) throw new BadRequestException(`Unsupported MCP tool status: ${value}`);
  return value as McpToolStatus;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
