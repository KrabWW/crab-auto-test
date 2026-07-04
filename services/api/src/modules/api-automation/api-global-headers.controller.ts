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
import { ApiGlobalHeadersService } from "./api-global-headers.service";
import type {
  CreateApiGlobalHeaderRequest,
  UpdateApiGlobalHeaderRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId/api-automation")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class ApiGlobalHeadersController {
  constructor(private readonly headers: ApiGlobalHeadersService) {}

  @Get("global-headers")
  list(@Param("projectId") projectId: string) {
    return this.headers.list(projectId);
  }

  @Post("global-headers")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiGlobalHeaderRequest,
  ) {
    return this.headers.create(projectId, user.userId, body);
  }

  @Patch("global-headers/:headerId")
  update(
    @Param("projectId") projectId: string,
    @Param("headerId") headerId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateApiGlobalHeaderRequest,
  ) {
    return this.headers.update(projectId, headerId, user.userId, body);
  }

  @Delete("global-headers/:headerId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("headerId") headerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.headers.delete(projectId, headerId, user.userId);
    return { ok: true };
  }
}
