import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ExecutionsService } from "./executions.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { CreateExecutionRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class ExecutionsController {
  constructor(private readonly executions: ExecutionsService) {}

  @Post("executions")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateExecutionRequest,
  ) {
    return this.executions.create(projectId, user.userId, body);
  }

  @Get("executions")
  list(@Param("projectId") projectId: string) {
    return this.executions.list(projectId);
  }

  @Get("executions/:id")
  get(@Param("id") id: string) {
    return this.executions.get(id);
  }

  /** R8 snapshot refetch endpoint — authoritative state on reconnect. */
  @Get("executions/:id/snapshot")
  snapshot(@Param("id") id: string) {
    return this.executions.getSnapshot(id);
  }
}
