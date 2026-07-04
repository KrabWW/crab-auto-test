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
import { ApiScenariosService } from "./api-scenarios.service";
import type {
  CreateApiScenarioRequest,
  CreateApiScenarioRunRequest,
  UpdateApiScenarioRequest,
  UpdateApiScenarioStepsRequest,
} from "@crab/shared-types";

@Controller("projects/:projectId/api-automation")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class ApiScenariosController {
  constructor(private readonly scenarios: ApiScenariosService) {}

  @Get("scenarios")
  list(@Param("projectId") projectId: string) {
    return this.scenarios.list(projectId);
  }

  @Post("scenarios")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiScenarioRequest,
  ) {
    return this.scenarios.create(projectId, user.userId, body);
  }

  @Get("scenarios/:scenarioId")
  get(@Param("projectId") projectId: string, @Param("scenarioId") scenarioId: string) {
    return this.scenarios.get(projectId, scenarioId);
  }

  @Patch("scenarios/:scenarioId")
  update(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateApiScenarioRequest,
  ) {
    return this.scenarios.update(projectId, scenarioId, user.userId, body);
  }

  @Delete("scenarios/:scenarioId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.scenarios.delete(projectId, scenarioId, user.userId);
    return { ok: true };
  }

  @Patch("scenarios/:scenarioId/steps")
  updateSteps(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateApiScenarioStepsRequest,
  ) {
    return this.scenarios.updateSteps(projectId, scenarioId, user.userId, body);
  }

  @Post("scenarios/:scenarioId/runs")
  run(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateApiScenarioRunRequest = {},
  ) {
    return this.scenarios.runScenario(projectId, scenarioId, user.userId, body);
  }

  @Get("scenario-runs")
  listRuns(@Param("projectId") projectId: string) {
    return this.scenarios.listRuns(projectId);
  }

  @Get("scenario-runs/:runId")
  getRun(@Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.scenarios.getRun(projectId, runId);
  }
}
