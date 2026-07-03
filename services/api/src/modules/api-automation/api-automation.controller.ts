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
import { ApiAutomationService } from "./api-automation.service";
import type {
  CreateApiEnvironmentRequest,
  CreateApiRunRequest,
  CreateApiTestCaseRequest,
  UpdateApiEnvironmentRequest,
  UpdateApiTestCaseRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId/api-automation")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class ApiAutomationController {
  constructor(private readonly apiAutomation: ApiAutomationService) {}

  @Get("environments")
  listEnvironments(@Param("projectId") projectId: string) {
    return this.apiAutomation.listEnvironments(projectId);
  }

  @Post("environments")
  createEnvironment(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiEnvironmentRequest,
  ) {
    return this.apiAutomation.createEnvironment(projectId, user.userId, body);
  }

  @Patch("environments/:environmentId")
  updateEnvironment(
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateApiEnvironmentRequest,
  ) {
    return this.apiAutomation.updateEnvironment(projectId, environmentId, user.userId, body);
  }

  @Delete("environments/:environmentId")
  deleteEnvironment(
    @Param("projectId") projectId: string,
    @Param("environmentId") environmentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.apiAutomation.deleteEnvironment(projectId, environmentId, user.userId);
  }

  @Get("cases")
  listCases(@Param("projectId") projectId: string) {
    return this.apiAutomation.listCases(projectId);
  }

  @Post("cases")
  createCase(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiTestCaseRequest,
  ) {
    return this.apiAutomation.createCase(projectId, user.userId, body);
  }

  @Get("cases/:caseId")
  getCase(@Param("projectId") projectId: string, @Param("caseId") caseId: string) {
    return this.apiAutomation.getCase(projectId, caseId);
  }

  @Patch("cases/:caseId")
  updateCase(
    @Param("projectId") projectId: string,
    @Param("caseId") caseId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateApiTestCaseRequest,
  ) {
    return this.apiAutomation.updateCase(projectId, caseId, user.userId, body);
  }

  @Delete("cases/:caseId")
  deleteCase(
    @Param("projectId") projectId: string,
    @Param("caseId") caseId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.apiAutomation.deleteCase(projectId, caseId, user.userId);
  }

  @Post("cases/:caseId/runs")
  runCase(
    @Param("projectId") projectId: string,
    @Param("caseId") caseId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiRunRequest,
  ) {
    return this.apiAutomation.runCase(projectId, caseId, user.userId, body ?? {});
  }

  @Get("executions")
  listExecutions(@Param("projectId") projectId: string) {
    return this.apiAutomation.listExecutions(projectId);
  }

  @Get("executions/:executionId")
  getExecution(
    @Param("projectId") projectId: string,
    @Param("executionId") executionId: string,
  ) {
    return this.apiAutomation.getExecution(projectId, executionId);
  }
}
