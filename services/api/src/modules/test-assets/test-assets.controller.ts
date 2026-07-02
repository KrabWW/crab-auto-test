import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TestAssetsService } from "./test-assets.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type {
  CreateModuleRequest,
  CreateTestCaseRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class TestAssetsController {
  constructor(private readonly assets: TestAssetsService) {}

  @Get("modules")
  modules(@Param("projectId") projectId: string) {
    return this.assets.listModules(projectId);
  }

  @Post("modules")
  createModule(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateModuleRequest,
  ) {
    return this.assets.createModule(projectId, user.userId, body);
  }

  @Get("test-cases")
  cases(
    @Param("projectId") projectId: string,
    @Query("moduleId") moduleId?: string,
  ) {
    return this.assets.listCases(projectId, moduleId);
  }

  @Post("test-cases")
  createCase(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateTestCaseRequest,
  ) {
    return this.assets.createCase(projectId, user.userId, body);
  }

  @Get("test-cases/:id")
  case(@Param("id") id: string) {
    return this.assets.getCase(id);
  }
}
