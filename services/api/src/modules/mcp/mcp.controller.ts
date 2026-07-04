import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { McpService } from "./mcp.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { CreateMcpToolRequest, TestMcpToolRequest } from "@crab/shared-types";

/**
 * MCP administration and backend invocation endpoints.
 *
 * Renderer/UI never imports the MCP SDK. All tool calls stay backend-managed
 * and pass through the project allowlist predicate before invocation.
 */
@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Get("mcp/tools")
  listTools(@Param("projectId") projectId: string) {
    return this.mcp.listTools(projectId);
  }

  @Post("mcp/tools")
  proposeTool(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateMcpToolRequest,
  ) {
    return this.mcp.proposeTool(projectId, user.userId, body);
  }

  @Post("mcp/tools/:toolId/review")
  reviewTool(
    @Param("projectId") projectId: string,
    @Param("toolId") toolId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mcp.reviewTool(projectId, toolId, user.userId);
  }

  @Post("mcp/tools/:toolId/approve")
  approveTool(
    @Param("projectId") projectId: string,
    @Param("toolId") toolId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mcp.approveTool(projectId, toolId, user.userId);
  }

  @Post("mcp/tools/:toolId/revoke")
  revokeTool(
    @Param("projectId") projectId: string,
    @Param("toolId") toolId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mcp.revokeTool(projectId, toolId, user.userId);
  }

  @Post("mcp/tools/:toolId/test-call")
  testTool(
    @Param("projectId") projectId: string,
    @Param("toolId") toolId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: TestMcpToolRequest,
  ) {
    return this.mcp.testTool(projectId, toolId, user.userId, body ?? {});
  }

  @Get("mcp/tools/:toolId/history")
  toolHistory(@Param("projectId") projectId: string, @Param("toolId") toolId: string) {
    return this.mcp.toolHistory(projectId, toolId);
  }

  @Get("mcp/allowlist")
  listAllowlist(@Param("projectId") projectId: string) {
    return this.mcp.listAllowlist(projectId);
  }

  @Get("ai/runs/:runId/tool-calls")
  listCalls(@Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.mcp.listCalls(projectId, runId);
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
