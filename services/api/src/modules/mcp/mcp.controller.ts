import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { McpService } from "./mcp.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";

/**
 * MCP backend mechanism endpoints (Phase 2).
 *
 * NOTE: mcp-admin governance UI (propose/review/approve/allowlist/revoke) is
 * Phase 3, spec-first gated. Phase 2 exposes only:
 *  - allowlist query/add (transitional, backend-internal config)
 *  - tool-call history query (backend-ai-orchestration.3 metadata)
 *  - tool invocation (used by ai-orchestration's MCP node)
 */
@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Get("mcp/allowlist")
  listAllowlist(@Param("projectId") projectId: string) {
    return this.mcp.listAllowlist(projectId);
  }

  @Post("mcp/allowlist")
  addAllowlist(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { toolName: string; serverRef: string; approved: boolean },
  ) {
    return this.mcp.addAllowlistEntry({
      projectId,
      toolName: body.toolName,
      serverRef: body.serverRef,
      approved: body.approved,
      approvedBy: user.userId,
    });
  }

  @Get("ai/runs/:runId/tool-calls")
  listCalls(@Param("runId") runId: string) {
    return this.mcp.listCalls(runId);
  }

  @Post("mcp/invoke")
  invoke(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { runId?: string; toolName: string; serverRef: string; args: Record<string, unknown> },
  ) {
    return this.mcp.invokeTool({
      projectId,
      runId: body.runId,
      toolName: body.toolName,
      serverRef: body.serverRef,
      args: body.args,
      actorId: user.userId,
    });
  }
}
