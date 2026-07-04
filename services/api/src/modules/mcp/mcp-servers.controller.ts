import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { McpServersService } from "./mcp-servers.service";
import type {
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId/mcp")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class McpServersController {
  constructor(private readonly servers: McpServersService) {}

  @Get("servers")
  list(@Param("projectId") projectId: string) {
    return this.servers.list(projectId);
  }

  @Get("servers/:serverId")
  get(@Param("projectId") projectId: string, @Param("serverId") serverId: string) {
    return this.servers.get(projectId, serverId);
  }

  @Post("servers")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateMcpServerRequest,
  ) {
    return this.servers.create(projectId, user.userId, body);
  }

  @Patch("servers/:serverId")
  update(
    @Param("projectId") projectId: string,
    @Param("serverId") serverId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateMcpServerRequest,
  ) {
    return this.servers.update(projectId, serverId, user.userId, body);
  }

  @Delete("servers/:serverId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("serverId") serverId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.servers.delete(projectId, serverId, user.userId);
    return { ok: true };
  }

  @Post("servers/:serverId/sync")
  sync(
    @Param("projectId") projectId: string,
    @Param("serverId") serverId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.servers.sync(projectId, serverId, user.userId);
  }
}
