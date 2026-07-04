import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { RequirementModulesService } from "./requirement-modules.service";
import type { UpdateRequirementModulesRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class RequirementModulesController {
  constructor(private readonly modules: RequirementModulesService) {}

  @Get("requirements/documents/:docId/modules")
  list(@Param("projectId") projectId: string, @Param("docId") docId: string) {
    return this.modules.list(projectId, docId);
  }

  @Post("requirements/documents/:docId/split-modules")
  split(
    @Param("projectId") projectId: string,
    @Param("docId") docId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.modules.autoSplit(projectId, docId, user.userId);
  }

  @Patch("requirements/documents/:docId/modules")
  update(
    @Param("projectId") projectId: string,
    @Param("docId") docId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateRequirementModulesRequest,
  ) {
    return this.modules.updateModules(projectId, docId, user.userId, body);
  }

  @Post("requirements/modules/:moduleId/promote")
  promote(
    @Param("projectId") projectId: string,
    @Param("moduleId") moduleId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.modules.promoteToRequirement(projectId, moduleId, user.userId);
  }
}
