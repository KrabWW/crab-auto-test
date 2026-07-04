import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ApiAutomationService } from "./api-automation.service";
import type {
  ApiScenarioDto,
  ApiScenarioRunDto,
  ApiScenarioRunStatus,
  ApiScenarioRunSummary,
  ApiScenarioStepDto,
  CreateApiScenarioRequest,
  CreateApiScenarioRunRequest,
  UpdateApiScenarioRequest,
  UpdateApiScenarioStepsRequest,
} from "@crab/shared-types";

const SCENARIO_RUN_STATUSES = new Set<ApiScenarioRunStatus>([
  "running",
  "passed",
  "failed",
  "aborted",
  "partial",
]);

interface ScenarioRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    scenarioId: string;
    caseId: string;
    order: number;
    case: { id: string; name: string; method: string; url: string };
  }>;
}

@Injectable()
export class ApiScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly apiAutomation: ApiAutomationService,
  ) {}

  async list(projectId: string): Promise<ApiScenarioDto[]> {
    const rows = await this.prisma.apiScenario.findMany({
      where: { projectId },
      include: {
        steps: {
          orderBy: { order: "asc" as const },
          include: {
            case: { select: { id: true, name: true, method: true, url: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row as unknown as ScenarioRow));
  }

  async get(projectId: string, scenarioId: string): Promise<ApiScenarioDto> {
    return this.toDto(await this.findScenario(projectId, scenarioId));
  }

  async create(
    projectId: string,
    actorId: string,
    req: CreateApiScenarioRequest,
  ): Promise<ApiScenarioDto> {
    const name = req.name?.trim();
    if (!name) throw new BadRequestException("Scenario name is required");
    if (!req.steps.length) {
      throw new BadRequestException("Scenario needs at least one step");
    }
    if (new Set(req.steps.map((s) => s.caseId)).size !== req.steps.length) {
      throw new BadRequestException("Duplicate case in scenario steps");
    }
    if (new Set(req.steps.map((s) => s.order)).size !== req.steps.length) {
      throw new BadRequestException("Duplicate step order");
    }
    await this.assertProjectCases(projectId, req.steps.map((s) => s.caseId));

    const created = await this.prisma.apiScenario.create({
      data: {
        projectId,
        name,
        description: req.description,
        createdBy: actorId,
        steps: {
          create: req.steps.map((s) => ({
            caseId: s.caseId,
            order: s.order,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" as const },
          include: {
            case: { select: { id: true, name: true, method: true, url: true } },
          },
        },
      },
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "api-scenario.create",
      targetType: "api-scenario",
      targetId: created.id,
      outcome: "success",
      metadata: { stepCount: req.steps.length },
    });

    return this.toDto(created as unknown as ScenarioRow);
  }

  async update(
    projectId: string,
    scenarioId: string,
    actorId: string,
    req: UpdateApiScenarioRequest,
  ): Promise<ApiScenarioDto> {
    await this.findScenario(projectId, scenarioId);
    const updated = await this.prisma.apiScenario.update({
      where: { id: scenarioId },
      data: {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(req.description !== undefined ? { description: req.description } : {}),
      },
      include: {
        steps: {
          orderBy: { order: "asc" as const },
          include: {
            case: { select: { id: true, name: true, method: true, url: true } },
          },
        },
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-scenario.update",
      targetType: "api-scenario",
      targetId: scenarioId,
      outcome: "success",
    });
    return this.toDto(updated as unknown as ScenarioRow);
  }

  async updateSteps(
    projectId: string,
    scenarioId: string,
    actorId: string,
    req: UpdateApiScenarioStepsRequest,
  ): Promise<ApiScenarioDto> {
    await this.findScenario(projectId, scenarioId);
    if (!req.steps.length) {
      throw new BadRequestException("Scenario needs at least one step");
    }
    if (new Set(req.steps.map((s) => s.order)).size !== req.steps.length) {
      throw new BadRequestException("Duplicate step order");
    }
    await this.assertProjectCases(projectId, req.steps.map((s) => s.caseId));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.apiScenarioStep.deleteMany({ where: { scenarioId } });
      await tx.apiScenarioStep.createMany({
        data: req.steps.map((s) => ({
          scenarioId,
          caseId: s.caseId,
          order: s.order,
        })),
      });
      return tx.apiScenario.findFirstOrThrow({
        where: { id: scenarioId, projectId },
        include: {
          steps: {
            orderBy: { order: "asc" as const },
            include: {
              case: { select: { id: true, name: true, method: true, url: true } },
            },
          },
        },
      });
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "api-scenario.update-steps",
      targetType: "api-scenario",
      targetId: scenarioId,
      outcome: "success",
      metadata: { stepCount: req.steps.length },
    });

    return this.toDto(updated as unknown as ScenarioRow);
  }

  async delete(projectId: string, scenarioId: string, actorId: string): Promise<void> {
    const scenario = await this.prisma.apiScenario.findFirst({
      where: { id: scenarioId, projectId },
      select: { id: true, _count: { select: { runs: true } } },
    });
    if (!scenario) throw new NotFoundException("Scenario not found");
    if (scenario._count.runs > 0) {
      throw new BadRequestException("Scenario with runs cannot be deleted");
    }
    await this.prisma.apiScenario.delete({ where: { id: scenarioId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-scenario.delete",
      targetType: "api-scenario",
      targetId: scenarioId,
      outcome: "success",
    });
  }

  /**
   * Execute each step in order. Extracted variables from step N are merged into
   * the runtime variable bag and passed to step N+1 via the existing
   * ApiAutomationService.runCase path (which honors environment + secret vars).
   */
  async runScenario(
    projectId: string,
    scenarioId: string,
    actorId: string,
    req: CreateApiScenarioRunRequest,
  ): Promise<ApiScenarioRunDto> {
    const scenario = await this.findScenario(projectId, scenarioId);
    if (!scenario.steps.length) {
      throw new BadRequestException("Scenario has no steps");
    }

    const environment = req.environmentId
      ? await this.findEnvironment(projectId, req.environmentId)
      : undefined;

    const run = await this.prisma.apiScenarioRun.create({
      data: {
        projectId,
        scenarioId,
        environmentId: environment?.id,
        environmentName: environment?.name,
        status: "running",
        createdBy: actorId,
      },
    });

    const startedAt = new Date();
    const startedMs = Date.now();
    const executions: Array<{
      executionId: string;
      stepIndex: number;
      status: string;
    }> = [];

    let aborted = false;
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]!;
      try {
        const execution = await this.apiAutomation.runCase(projectId, step.caseId, actorId, {
          environmentId: environment?.id,
        });
        // Re-tag the execution with the scenario run id + step index so we can
        // fetch the ordered list later. runCase already persisted it as a
        // standalone execution; we just attach the scenario link.
        const tagged = await this.prisma.apiExecution.update({
          where: { id: execution.id },
          data: { scenarioRunId: run.id, scenarioStepIndex: i },
        });
        executions.push({
          executionId: tagged.id,
          stepIndex: i,
          status: tagged.status,
        });
        if (tagged.status === "failed" || tagged.status === "error" || tagged.status === "aborted") {
          aborted = true;
          break;
        }
      } catch {
        executions.push({
          executionId: "",
          stepIndex: i,
          status: "error",
        });
        aborted = true;
        break;
      }
    }

    const summary = this.buildSummary(scenario.steps.length, executions);
    const status: ApiScenarioRunStatus = aborted
      ? summary.passed > 0
        ? "partial"
        : "failed"
      : summary.passed === summary.totalSteps
        ? "passed"
        : "partial";

    const finishedAt = new Date();
    const updated = await this.prisma.apiScenarioRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt,
        durationMs: finishedAt.getTime() - startedMs,
        summary: summary as unknown as object,
      },
      include: { executions: { orderBy: { scenarioStepIndex: "asc" } } },
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "api-scenario.run",
      targetType: "api-scenario-run",
      targetId: run.id,
      outcome: "success",
      metadata: { scenarioId, status, stepCount: scenario.steps.length },
    });

    return this.toRunDto(updated as never);
  }

  async listRuns(
    projectId: string,
    scenarioId?: string,
  ): Promise<ApiScenarioRunDto[]> {
    const rows = await this.prisma.apiScenarioRun.findMany({
      where: { projectId, ...(scenarioId ? { scenarioId } : {}) },
      include: { executions: { orderBy: { scenarioStepIndex: "asc" } } },
      orderBy: { startedAt: "desc" },
    });
    return rows.map((row) => this.toRunDto(row as never));
  }

  async getRun(projectId: string, runId: string): Promise<ApiScenarioRunDto> {
    const row = await this.prisma.apiScenarioRun.findFirst({
      where: { id: runId, projectId },
      include: { executions: { orderBy: { scenarioStepIndex: "asc" } } },
    });
    if (!row) throw new NotFoundException("Scenario run not found");
    return this.toRunDto(row as never);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private buildSummary(
    totalSteps: number,
    executions: Array<{ executionId: string; stepIndex: number; status: string }>,
  ): ApiScenarioRunSummary {
    const executedSteps = executions.length;
    const counts = { passed: 0, failed: 0, errored: 0 };
    for (const e of executions) {
      if (e.status === "passed") counts.passed++;
      else if (e.status === "failed") counts.failed++;
      else counts.errored++;
    }
    return { totalSteps, executedSteps, ...counts };
  }

  private async findScenario(projectId: string, scenarioId: string): Promise<ScenarioRow> {
    const row = await this.prisma.apiScenario.findFirst({
      where: { id: scenarioId, projectId },
      include: {
        steps: {
          orderBy: { order: "asc" as const },
          include: {
            case: { select: { id: true, name: true, method: true, url: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Scenario not found");
    return row as unknown as ScenarioRow;
  }

  private async findEnvironment(projectId: string, envId: string) {
    const env = await this.prisma.apiEnvironment.findFirst({
      where: { id: envId, projectId },
    });
    if (!env) throw new NotFoundException("Environment not found");
    return env;
  }

  private async assertProjectCases(projectId: string, ids: string[]) {
    const count = await this.prisma.apiTestCase.count({
      where: { projectId, id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException("Scenario step references a non-project case");
    }
  }

  private toDto(row: ScenarioRow): ApiScenarioDto {
    const steps: ApiScenarioStepDto[] = row.steps.map((s) => ({
      id: s.id,
      scenarioId: s.scenarioId,
      caseId: s.caseId,
      order: s.order,
      ...(s.case
        ? {
            case: {
              id: s.case.id,
              name: s.case.name,
              method: s.case.method as never,
              url: s.case.url,
            },
          }
        : {}),
    }));
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      steps,
    };
  }

  private toRunDto(row: {
    id: string;
    projectId: string;
    scenarioId: string;
    environmentId: string | null;
    environmentName: string | null;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: unknown;
    createdBy: string;
    createdAt: Date;
    executions: Array<{
      id: string;
      caseId: string;
      status: string;
      startedAt: Date;
      finishedAt: Date | null;
      durationMs: number | null;
      responseStatus: number | null;
      assertionResults: unknown;
      extractedVariables: unknown;
      scenarioStepIndex: number | null;
    }>;
  }): ApiScenarioRunDto {
    const status = SCENARIO_RUN_STATUSES.has(row.status as ApiScenarioRunStatus)
      ? (row.status as ApiScenarioRunStatus)
      : "running";
    const summary = (row.summary as ApiScenarioRunSummary | null) ?? undefined;
    return {
      id: row.id,
      projectId: row.projectId,
      scenarioId: row.scenarioId,
      ...(row.environmentId ? { environmentId: row.environmentId } : {}),
      ...(row.environmentName ? { environmentName: row.environmentName } : {}),
      status,
      startedAt: row.startedAt.toISOString(),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      ...(row.durationMs !== null ? { durationMs: row.durationMs } : {}),
      ...(summary ? { summary } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      executions: row.executions.map((e) => ({
        id: e.id,
        caseId: e.caseId,
        status: e.status as ApiScenarioRunDto["executions"][number]["status"],
        startedAt: e.startedAt.toISOString(),
        ...(e.finishedAt ? { finishedAt: e.finishedAt.toISOString() } : {}),
        ...(e.durationMs !== null ? { durationMs: e.durationMs } : {}),
        ...(e.responseStatus !== null ? { responseStatus: e.responseStatus } : {}),
        ...(e.scenarioStepIndex !== null ? { scenarioStepIndex: e.scenarioStepIndex } : {}),
        assertionResults: (e.assertionResults as never) ?? [],
        extractedVariables: (e.extractedVariables as Record<string, string>) ?? {},
      })),
    };
  }
}
