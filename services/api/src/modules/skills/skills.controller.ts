import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SkillsService, type SkillPackageManifest } from "./skills.service";
import { SkillAdapterService, type SkillAdapterKind } from "./skill-adapter.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { InvokeSkillTestRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly skillAdapter: SkillAdapterService,
  ) {}

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
    @Param("projectId") projectId: string,
    @Param("installationId") installationId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { permissions: Record<string, unknown> },
  ) {
    return this.skills.approvePermissions(projectId, installationId, user.userId, body.permissions);
  }

  @Post("skills/:installationId/enable")
  enable(
    @Param("projectId") projectId: string,
    @Param("installationId") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.skills.enable(projectId, id, user.userId);
  }

  @Post("skills/:installationId/disable")
  disable(
    @Param("projectId") projectId: string,
    @Param("installationId") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.skills.disable(projectId, id, user.userId);
  }

  @Post("skills/:installationId/uninstall")
  uninstall(
    @Param("projectId") projectId: string,
    @Param("installationId") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.skills.uninstall(projectId, id, user.userId);
  }

  @Post("skills/:installationId/rollback")
  rollback(
    @Param("projectId") projectId: string,
    @Param("installationId") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.skills.rollback(projectId, id, user.userId);
  }

  @Get("skills/:installationId/invocations")
  invocations(@Param("projectId") projectId: string, @Param("installationId") id: string) {
    return this.skills.listInvocations(projectId, id);
  }

  @Post("skills/:installationId/test-invoke")
  async testInvoke(
    @Param("projectId") projectId: string,
    @Param("installationId") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: InvokeSkillTestRequest = {},
  ) {
    const installation = await this.skills.getInstallation(projectId, id);
    const entryPoint = body.entryPoint ?? Object.keys(installation.skill.entryPoints)[0];
    if (!entryPoint) throw new BadRequestException("No entryPoint configured for this skill");
    await this.skillAdapter
      .invoke({
        installationId: id,
        adapter: body.adapter ?? adapterFor(installation.skill.entryPoints[entryPoint]),
        entryPoint,
        args: body.args ?? { source: "skills-management-test" },
        actorId: user.userId,
      })
      .catch((err: unknown) => {
        if (err instanceof BadRequestException || err instanceof ForbiddenException) return undefined;
        throw err;
      });
    return this.skills.listInvocations(projectId, id);
  }
}

function adapterFor(entryPointConfig: unknown): SkillAdapterKind {
  if (!entryPointConfig || typeof entryPointConfig !== "object" || Array.isArray(entryPointConfig)) return "langgraph";
  const adapter = (entryPointConfig as { adapter?: unknown }).adapter;
  return adapter === "mcp" || adapter === "worker" || adapter === "langgraph" ? adapter : "langgraph";
}
