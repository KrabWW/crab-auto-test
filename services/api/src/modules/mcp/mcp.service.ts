import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { redact } from "../../common/redact";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * backend-ai-orchestration.3: MCP integrations are backend-managed.
 *
 * §11 a5: MCP tools are PROJECT-SCOPED ONLY — no global tools, no global admin.
 * The allowlist (McpToolAllowlist) is the source of truth for which tools a
 * project may call. mcp-admin (Phase 3) will OWN the "reject non-allowlisted
 * before invocation" predicate as single source of truth; in Phase 2 this
 * service enforces it directly from the allowlist table (transitional — code
 * comments mark this; the third OpenSpec change MODIFIES backend-ai-
 * orchestration.3 to reference mcp-admin).
 *
 * §11 a7: the MCP client is backend-hosted ONLY — never exposed to
 * renderer/worker (CI scan enforces no MCP import outside services/api).
 *
 * Every call records a McpToolCall (tool/server/approved/argsRedacted/
 * resultMeta/status/timing).
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

  /**
   * backend-ai-orchestration.3 + mcp-admin (Phase 3 SOT): invoke an MCP tool
   * ONLY if it is on the project's approved allowlist. Records McpToolCall for
   * both approved and rejected calls.
   */
  async invokeTool(input: {
    projectId: string;
    runId?: string;
    toolName: string;
    serverRef: string;
    args: Record<string, unknown>;
    actorId: string;
  }): Promise<{ approved: boolean; status: "success" | "failure" | "rejected"; resultMeta: Record<string, unknown> }> {
    // Allowlist check (project-scoped). §11 a5: no global tools.
    const allowlisted = await this.prisma.mcpToolAllowlist.findUnique({
      where: {
        projectId_toolName_serverRef: {
          projectId: input.projectId,
          toolName: input.toolName,
          serverRef: input.serverRef,
        },
      },
    });
    const approved = Boolean(allowlisted?.approved);

    if (!approved) {
      // Rejected before invocation. Record + audit.
      await this.recordCall({ ...input, approved: false, status: "rejected", resultMeta: { reason: "not on approved allowlist" } });
      return { approved: false, status: "rejected", resultMeta: { reason: "not on approved allowlist" } };
    }

    try {
      const client = await this.getClient(input.serverRef);
      const result = await client.callTool({
        name: input.toolName,
        arguments: input.args,
      });
      const resultMeta = { content: result.content, isError: result.isError ?? false } as Record<string, unknown>;
      await this.recordCall({ ...input, approved: true, status: result.isError ? "failure" : "success", resultMeta });
      return { approved: true, status: result.isError ? "failure" : "success", resultMeta };
    } catch (err) {
      const resultMeta = { error: (err as Error).message };
      await this.recordCall({ ...input, approved: true, status: "failure", resultMeta });
      this.logger.warn(`MCP tool ${input.toolName} failed: ${(err as Error).message}`);
      return { approved: true, status: "failure", resultMeta };
    }
  }

  /** Query McpToolCall history for a run (backend-ai-orchestration.3 metadata). */
  async listCalls(runId: string) {
    return this.prisma.mcpToolCall.findMany({
      where: { runId },
      orderBy: { startedAt: "asc" },
    });
  }

  /** Phase 2 transitional allowlist management (no UI; mcp-admin UI = Phase 3). */
  async addAllowlistEntry(input: {
    projectId: string;
    toolName: string;
    serverRef: string;
    approved: boolean;
    approvedBy: string;
  }) {
    return this.prisma.mcpToolAllowlist.upsert({
      where: {
        projectId_toolName_serverRef: {
          projectId: input.projectId,
          toolName: input.toolName,
          serverRef: input.serverRef,
        },
      },
      create: { ...input },
      update: { approved: input.approved, approvedBy: input.approvedBy },
    });
  }

  async listAllowlist(projectId: string) {
    return this.prisma.mcpToolAllowlist.findMany({ where: { projectId } });
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
    runId?: string;
    toolName: string;
    serverRef: string;
    approved: boolean;
    status: "success" | "failure" | "rejected";
    resultMeta: Record<string, unknown>;
    actorId: string;
    projectId: string;
  }) {
    await this.prisma.mcpToolCall.create({
      data: {
        runId: input.runId,
        toolName: input.toolName,
        serverRef: input.serverRef,
        approved: input.approved,
        argsRedacted: redact({}) as object, // args not persisted; only redacted placeholder
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
}
