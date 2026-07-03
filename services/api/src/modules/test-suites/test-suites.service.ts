import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateSuiteRunRequest,
  CreateTestSuiteRequest,
  ExecutionArtifactType,
  ExecutionDto,
  ExecutionStatus,
  SuiteRunStatus,
  SuiteRunDto,
  TestCasePriority,
  TestCaseStatus,
  TestSuiteDto,
  UpdateTestSuiteRequest,
  UpdateTestSuiteCasesRequest,
} from "@crab/shared-types";

export function rollupSuiteStatus(
  statuses: ExecutionStatus[],
  current: SuiteRunStatus,
): SuiteRunStatus {
  if (current === "aborted") return "aborted";
  if (statuses.length === 0) return "queued";
  const isTerminal = (s: ExecutionStatus) => ["passed", "failed", "aborted", "timeout"].includes(s);
  if (statuses.some((s) => s === "aborted")) return "aborted";
  const terminalCount = statuses.filter(isTerminal).length;
  if (terminalCount > 0 && terminalCount < statuses.length) return "partial";
  if (terminalCount < statuses.length) {
    return statuses.some((s) => s === "running" || s === "dispatched") ? "running" : "queued";
  }
  return statuses.every((s) => s === "passed") ? "passed" : "failed";
}

@Injectable()
export class TestSuitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<TestSuiteDto[]> {
    const rows = await this.prisma.testSuite.findMany({
      where: { projectId },
      include: this.suiteInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this.toSuiteDto);
  }

  async get(projectId: string, suiteId: string): Promise<TestSuiteDto> {
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, projectId },
      include: this.suiteInclude,
    });
    if (!suite) throw new NotFoundException("Test suite not found");
    return this.toSuiteDto(suite);
  }

  async create(
    projectId: string,
    actorId: string,
    req: CreateTestSuiteRequest,
  ): Promise<TestSuiteDto> {
    this.assertCases(req.cases);
    await this.assertProjectCases(projectId, req.cases.map((c) => c.testCaseId));

    const suite = await this.prisma.testSuite.create({
      data: {
        projectId,
        name: req.name,
        description: req.description,
        createdBy: actorId,
        cases: { create: req.cases.map((c) => ({ testCaseId: c.testCaseId, order: c.order })) },
      },
      include: this.suiteInclude,
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "test-suite.create",
      targetType: "test-suite",
      targetId: suite.id,
      outcome: "success",
      metadata: { caseCount: req.cases.length },
    });
    return this.toSuiteDto(suite);
  }

  async update(
    projectId: string,
    suiteId: string,
    actorId: string,
    req: UpdateTestSuiteRequest,
  ): Promise<TestSuiteDto> {
    await this.get(projectId, suiteId);
    const suite = await this.prisma.testSuite.update({
      where: { id: suiteId },
      data: {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(req.description !== undefined ? { description: req.description } : {}),
      },
      include: this.suiteInclude,
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "test-suite.update",
      targetType: "test-suite",
      targetId: suite.id,
      outcome: "success",
    });
    return this.toSuiteDto(suite);
  }

  async delete(projectId: string, suiteId: string, actorId: string): Promise<void> {
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, projectId },
      select: { id: true, _count: { select: { runs: true } } },
    });
    if (!suite) throw new NotFoundException("Test suite not found");
    if (suite._count.runs > 0) {
      throw new BadRequestException("Test suite with runs cannot be deleted");
    }
    await this.prisma.testSuite.delete({ where: { id: suiteId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "test-suite.delete",
      targetType: "test-suite",
      targetId: suiteId,
      outcome: "success",
    });
  }

  async updateCases(
    projectId: string,
    suiteId: string,
    req: UpdateTestSuiteCasesRequest,
  ): Promise<TestSuiteDto> {
    this.assertCases(req.cases);
    await this.get(projectId, suiteId);
    await this.assertProjectCases(projectId, req.cases.map((c) => c.testCaseId));

    const suite = await this.prisma.$transaction(async (tx) => {
      await tx.testSuiteCase.deleteMany({ where: { suiteId } });
      await tx.testSuiteCase.createMany({
        data: req.cases.map((c) => ({ suiteId, testCaseId: c.testCaseId, order: c.order })),
      });
      return tx.testSuite.findFirstOrThrow({
        where: { id: suiteId, projectId },
        include: this.suiteInclude,
      });
    });
    return this.toSuiteDto(suite);
  }

  async createRun(
    projectId: string,
    suiteId: string,
    actorId: string,
    req: CreateSuiteRunRequest,
  ): Promise<SuiteRunDto> {
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, projectId },
      include: { cases: { orderBy: { order: "asc" } } },
    });
    if (!suite) throw new NotFoundException("Test suite not found");
    if (!suite.cases.length) throw new BadRequestException("Suite has no test cases");

    const run = await this.prisma.$transaction(async (tx) => {
      const executions = [];
      for (const c of suite.cases) {
        executions.push(
          await tx.testExecution.create({
            data: {
              projectId,
              testCaseId: c.testCaseId,
              createdBy: actorId,
              environment: req.environment,
              status: "queued",
            },
            include: { artifacts: true },
          }),
        );
      }
      return tx.suiteRun.create({
        data: {
          projectId,
          suiteId,
          environment: req.environment,
          status: "queued",
          executionIds: executions.map((e) => e.id),
          createdBy: actorId,
        },
      });
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "test-suite.run",
      targetType: "suite-run",
      targetId: run.id,
      outcome: "success",
      metadata: { suiteId, caseCount: suite.cases.length },
    });
    return this.getRun(projectId, run.id);
  }

  async getRun(projectId: string, runId: string): Promise<SuiteRunDto> {
    const run = await this.prisma.suiteRun.findFirst({ where: { id: runId, projectId } });
    if (!run) throw new NotFoundException("Suite run not found");

    const executions = await this.prisma.testExecution.findMany({
      where: { id: { in: run.executionIds }, projectId },
      include: { artifacts: true },
    });
    const byId = new Map(executions.map((e) => [e.id, e]));
    const ordered = run.executionIds.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
    const status = rollupSuiteStatus(ordered.map((e) => e.status as ExecutionStatus), run.status as SuiteRunStatus);
    const firstStarted = ordered[0]?.startedAt ?? run.startedAt;
    const lastFinished = ordered.every((e) => e.finishedAt) ? ordered.at(-1)?.finishedAt : null;
    const durationMs = lastFinished ? lastFinished.getTime() - firstStarted.getTime() : null;

    const current =
      status !== run.status || (lastFinished && !run.finishedAt)
        ? await this.prisma.suiteRun.update({
            where: { id: run.id },
            data: { status, finishedAt: lastFinished, durationMs },
          })
        : run;

    return {
      id: current.id,
      projectId: current.projectId,
      suiteId: current.suiteId,
      environment: current.environment,
      status: current.status as SuiteRunStatus,
      executionIds: current.executionIds,
      startedAt: current.startedAt.toISOString(),
      finishedAt: current.finishedAt?.toISOString(),
      durationMs: current.durationMs ?? undefined,
      createdBy: current.createdBy,
      createdAt: current.createdAt.toISOString(),
      executions: ordered.map((e) => this.toExecutionDto(e, e.artifacts)),
    };
  }

  private readonly suiteInclude = {
    cases: {
      include: {
        testCase: { select: { id: true, title: true, priority: true, status: true } },
      },
      orderBy: { order: "asc" as const },
    },
  };

  private assertCases(cases: Array<{ testCaseId: string; order: number }>) {
    if (!cases.length) throw new BadRequestException("Suite needs at least one test case");
    if (new Set(cases.map((c) => c.testCaseId)).size !== cases.length) {
      throw new BadRequestException("Duplicate suite test case");
    }
  }

  private async assertProjectCases(projectId: string, ids: string[]) {
    const count = await this.prisma.testCase.count({ where: { projectId, id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException("Suite contains non-project test case");
  }

  private toSuiteDto = (s: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    cases: Array<{
      testCaseId: string;
      order: number;
      testCase: { id: string; title: string; priority: TestCasePriority; status: TestCaseStatus };
    }>;
  }): TestSuiteDto => ({
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    description: s.description ?? undefined,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    cases: s.cases.map((c) => ({
      testCaseId: c.testCaseId,
      order: c.order,
      testCase: c.testCase,
    })),
  });

  private toExecutionDto = (
    e: {
      id: string;
      projectId: string;
      testCaseId: string;
      createdBy: string;
      environment: string;
      status: ExecutionStatus;
      startedAt: Date;
      finishedAt: Date | null;
      durationMs: number | null;
      failedStepId: string | null;
      reportSummary: unknown;
      workerJobId: string | null;
    },
    artifacts: Array<{
      id: string;
      executionId: string;
      type: ExecutionArtifactType;
      storageRef: string;
      filename: string;
      sizeBytes: bigint;
      checksum: string;
      capturedAt: Date;
      metadata: unknown;
      truncated: boolean;
    }>,
  ): ExecutionDto => ({
    id: e.id,
    projectId: e.projectId,
    testCaseId: e.testCaseId,
    createdBy: e.createdBy,
    environment: e.environment,
    status: e.status,
    startedAt: e.startedAt.toISOString(),
    finishedAt: e.finishedAt?.toISOString(),
    durationMs: e.durationMs ?? undefined,
    failedStepId: e.failedStepId ?? undefined,
    reportSummary: (e.reportSummary as Record<string, unknown>) ?? undefined,
    workerJobId: e.workerJobId ?? undefined,
    artifacts: artifacts.map((a) => ({
      id: a.id,
      executionId: a.executionId,
      type: a.type,
      storageRef: a.storageRef,
      filename: a.filename,
      sizeBytes: Number(a.sizeBytes),
      checksum: a.checksum,
      capturedAt: a.capturedAt.toISOString(),
      metadata: (a.metadata as Record<string, unknown>) ?? undefined,
      truncated: a.truncated,
    })),
  });
}
