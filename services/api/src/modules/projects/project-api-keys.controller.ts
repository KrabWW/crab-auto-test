import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "./membership.guard";
import { ProjectApiKeysService } from "./project-api-keys.service";
import type { CreateProjectApiKeyRequest } from "@crab/shared-types";

@Controller("projects/:projectId/api-keys")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class ProjectApiKeysController {
  constructor(private readonly keys: ProjectApiKeysService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.keys.list(projectId);
  }

  @Post()
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateProjectApiKeyRequest,
  ) {
    return this.keys.create(projectId, user.userId, body);
  }

  @Post(":keyId/revoke")
  revoke(
    @Param("projectId") projectId: string,
    @Param("keyId") keyId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.keys.revoke(projectId, keyId, user.userId);
  }

  @Delete(":keyId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("keyId") keyId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.keys.delete(projectId, keyId, user.userId);
    return { ok: true };
  }
}
