import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  ModuleDto,
  TestCaseDto,
  CreateModuleRequest,
  CreateTestCaseRequest,
  TestCasePriority,
  TestCaseStatus,
  TestCaseOrigin,
} from "@crab/shared-types";

/** test-asset-management.1: modules, cases, ordered steps. */
@Injectable()
export class TestAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Modules ────────────────────────────────────────────────────────────
  async createModule(
    projectId: string,
    actorId: string,
    req: CreateModuleRequest,
  ): Promise<ModuleDto> {
    const m = await this.prisma.module.create({
      data: {
        projectId,
        parentId: req.parentId,
        name: req.name,
        order: req.order ?? 0,
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "module.create",
      targetType: "module",
      targetId: m.id,
      outcome: "success",
    });
    return this.toModuleDto(m);
  }

  async listModules(projectId: string): Promise<ModuleDto[]> {
    const rows = await this.prisma.module.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    return rows.map(this.toModuleDto);
  }

  // ── Test cases ─────────────────────────────────────────────────────────
  async createCase(
    projectId: string,
    actorId: string,
    req: CreateTestCaseRequest,
    origin: TestCaseOrigin = "manual",
    aiRunId?: string,
  ): Promise<TestCaseDto> {
    // DB enum uses snake_case (Prisma forbids hyphens); map from shared-types.
    const dbOrigin = origin === "ai-generated" ? "ai_generated" : "manual";
    const created = await this.prisma.testCase.create({
      data: {
        projectId,
        moduleId: req.moduleId,
        title: req.title,
        preconditions: req.preconditions,
        priority: req.priority,
        tags: req.tags ?? [],
        notes: req.notes,
        origin: dbOrigin,
        aiRunId,
        createdBy: actorId,
        steps: req.steps?.length
          ? {
              create: req.steps.map((s) => ({
                order: s.order,
                action: s.action,
                expectedResult: s.expectedResult,
                data: s.data as never,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "test-case.create",
      targetType: "test-case",
      targetId: created.id,
      outcome: "success",
      metadata: { origin: dbOrigin, aiRunId },
    });
    return this.toCaseDto(created);
  }

  async listCases(projectId: string, moduleId?: string): Promise<TestCaseDto[]> {
    const rows = await this.prisma.testCase.findMany({
      where: { projectId, moduleId },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toCaseDto(r));
  }

  async getCase(id: string): Promise<TestCaseDto> {
    const c = await this.prisma.testCase.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!c) throw new NotFoundException("Test case not found");
    return this.toCaseDto(c);
  }

  /** Persist-handoff target for AiOrchestration (R1/MUST-1). Idempotent by runId+title. */
  async persistAcceptedDrafts(
    projectId: string,
    actorId: string,
    aiRunId: string,
    drafts: Array<{
      title: string;
      priority: TestCasePriority;
      preconditions?: string;
      steps: Array<{ order: number; action: string; expectedResult?: string }>;
      expectedResults?: string;
    }>,
    moduleId?: string,
  ): Promise<TestCaseDto[]> {
    return this.prisma.$transaction(async (tx) => {
      // Idempotency: skip titles already persisted for this run.
      const existing = await tx.testCase.findMany({
        where: { projectId, aiRunId },
        select: { title: true },
      });
      const existingTitles = new Set(existing.map((e) => e.title));
      const out: TestCaseDto[] = [];
      for (const d of drafts) {
        if (existingTitles.has(d.title)) continue;
        const created = await tx.testCase.create({
          data: {
            projectId,
            moduleId,
            title: d.title,
            preconditions: d.preconditions,
            priority: d.priority,
            status: "draft" as TestCaseStatus,
            tags: [],
            origin: "ai_generated",
            aiRunId,
            createdBy: actorId,
            steps: {
              create: d.steps.map((s) => ({
                order: s.order,
                action: s.action,
                expectedResult: s.expectedResult,
              })),
            },
          },
          include: { steps: { orderBy: { order: "asc" } } },
        });
        out.push(this.toCaseDto(created));
      }
      await this.audit.record({
        actorId,
        projectId,
        action: "test-case.persist-from-ai",
        targetType: "ai-run",
        targetId: aiRunId,
        outcome: "success",
        metadata: { count: out.length },
      });
      return out;
    });
  }

  private toModuleDto = (m: {
    id: string;
    projectId: string;
    parentId: string | null;
    name: string;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }): ModuleDto => ({
    id: m.id,
    projectId: m.projectId,
    parentId: m.parentId ?? undefined,
    name: m.name,
    order: m.order,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  });

  private toCaseDto = (c: {
    id: string;
    projectId: string;
    moduleId: string | null;
    title: string;
    preconditions: string | null;
    priority: TestCasePriority;
    status: TestCaseStatus;
    tags: string[];
    notes: string | null;
    origin: "manual" | "ai_generated";
    aiRunId: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    steps: Array<{
      id: string;
      testCaseId: string;
      order: number;
      action: string;
      expectedResult: string | null;
      data: unknown;
    }>;
  }): TestCaseDto => ({
    id: c.id,
    projectId: c.projectId,
    moduleId: c.moduleId ?? undefined,
    title: c.title,
    preconditions: c.preconditions ?? undefined,
    priority: c.priority,
    status: c.status,
    tags: c.tags,
    notes: c.notes ?? undefined,
    origin: c.origin === "ai_generated" ? "ai-generated" : "manual",
    aiRunId: c.aiRunId ?? undefined,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    steps: c.steps.map((s) => ({
      id: s.id,
      testCaseId: s.testCaseId,
      order: s.order,
      action: s.action,
      expectedResult: s.expectedResult ?? undefined,
      data: s.data as unknown | undefined,
    })),
  });
}
