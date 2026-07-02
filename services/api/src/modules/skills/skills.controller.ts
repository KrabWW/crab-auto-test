import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SkillsService, type SkillPackageManifest } from "./skills.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get("skills")
  list(@Param("projectId") projectId: string) {
    return this.skills.listInstallations(projectId);
  }

  @Post("skills/install")
  install(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: SkillPackageManifest,
  ) {
    return this.skills.install(projectId, user.userId, body);
  }

  @Post("skills/:installationId/permissions/approve")
  approve(
    @Param("installationId") installationId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { permissions: Record<string, unknown> },
  ) {
    return this.skills.approvePermissions(installationId, user.userId, body.permissions);
  }

  @Post("skills/:installationId/disable")
  disable(@Param("installationId") id: string, @CurrentUser() user: RequestUser) {
    return this.skills.disable(id, user.userId);
  }

  @Post("skills/:installationId/uninstall")
  uninstall(@Param("installationId") id: string, @CurrentUser() user: RequestUser) {
    return this.skills.uninstall(id, user.userId);
  }

  @Post("skills/:installationId/rollback")
  rollback(@Param("installationId") id: string, @CurrentUser() user: RequestUser) {
    return this.skills.rollback(id, user.userId);
  }
}
