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
import { TestSuitesService } from "./test-suites.service";
import type {
  CreateSuiteRunRequest,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  UpdateTestSuiteCasesRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class TestSuitesController {
  constructor(private readonly suites: TestSuitesService) {}

  @Get("test-suites")
  list(@Param("projectId") projectId: string) {
    return this.suites.list(projectId);
  }

  @Post("test-suites")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateTestSuiteRequest,
  ) {
    return this.suites.create(projectId, user.userId, body);
  }

  @Get("test-suites/:suiteId")
  get(@Param("projectId") projectId: string, @Param("suiteId") suiteId: string) {
    return this.suites.get(projectId, suiteId);
  }

  @Patch("test-suites/:suiteId")
  update(
    @Param("projectId") projectId: string,
    @Param("suiteId") suiteId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateTestSuiteRequest,
  ) {
    return this.suites.update(projectId, suiteId, user.userId, body);
  }

  @Delete("test-suites/:suiteId")
  delete(
    @Param("projectId") projectId: string,
    @Param("suiteId") suiteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suites.delete(projectId, suiteId, user.userId);
  }

  @Patch("test-suites/:suiteId/cases")
  updateCases(
    @Param("projectId") projectId: string,
    @Param("suiteId") suiteId: string,
    @Body() body: UpdateTestSuiteCasesRequest,
  ) {
    return this.suites.updateCases(projectId, suiteId, body);
  }

  @Post("test-suites/:suiteId/runs")
  run(
    @Param("projectId") projectId: string,
    @Param("suiteId") suiteId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateSuiteRunRequest,
  ) {
    return this.suites.createRun(projectId, suiteId, user.userId, body);
  }

  @Get("suite-runs/:runId")
  runSummary(@Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.suites.getRun(projectId, runId);
  }
}
