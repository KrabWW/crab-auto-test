import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { RequirementsService } from "./requirements.service";
import type { CreateRequirementRequest, UpdateRequirementRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get("requirements")
  list(@Param("projectId") projectId: string) {
    return this.requirements.list(projectId);
  }

  @Get("requirements/approved-versions")
  approvedVersions(@Param("projectId") projectId: string) {
    return this.requirements.approvedVersions(projectId);
  }

  @Post("requirements")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateRequirementRequest,
  ) {
    return this.requirements.create(projectId, user.userId, body);
  }

  @Get("requirements/:requirementId")
  get(@Param("projectId") projectId: string, @Param("requirementId") requirementId: string) {
    return this.requirements.get(projectId, requirementId);
  }

  @Patch("requirements/:requirementId")
  update(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateRequirementRequest,
  ) {
    return this.requirements.update(projectId, requirementId, user.userId, body);
  }

  @Post("requirements/:requirementId/submit-review")
  submitReview(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requirements.submitReview(projectId, requirementId, user.userId);
  }

  @Post("requirements/:requirementId/approve")
  approve(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requirements.approve(projectId, requirementId, user.userId);
  }

  @Post("requirements/:requirementId/reject")
  reject(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requirements.reject(projectId, requirementId, user.userId);
  }

  @Post("requirements/:requirementId/archive")
  archive(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requirements.archive(projectId, requirementId, user.userId);
  }

  @Delete("requirements/:requirementId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("requirementId") requirementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.requirements.delete(projectId, requirementId, user.userId);
    return { ok: true };
  }
}
