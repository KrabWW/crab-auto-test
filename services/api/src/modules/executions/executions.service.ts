import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SnapshotService } from "../../infra/streaming/snapshot.service";
import type {
  ExecutionDto,
  ExecutionArtifactDto,
  ExecutionStatus,
  ExecutionArtifactType,
  CreateExecutionRequest,
  StreamEnvelope,
} from "@crab/shared-types";

/** test-asset-management.2–3: execution records + artifacts + R8 streaming. */
@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly snapshot: SnapshotService,
  ) {}

  async create(
    projectId: string,
    actorId: string,
    req: CreateExecutionRequest,
  ): Promise<ExecutionDto> {
    const exec = await this.prisma.testExecution.create({
      data: {
        projectId,
        testCaseId: req.testCaseId,
        environment: req.environment,
        status: "queued",
      },
      include: { artifacts: true },
    });
    this.snapshot.register(exec.id);
    await this.audit.record({
      actorId,
      projectId,
      action: "execution.create",
      targetType: "execution",
      targetId: exec.id,
      outcome: "success",
    });
    return this.toDto(exec, []);
  }

  async get(id: string): Promise<ExecutionDto> {
    const exec = await this.prisma.testExecution.findUnique({
      where: { id },
      include: { artifacts: true },
    });
    if (!exec) throw new NotFoundException("Execution not found");
    return this.toDto(exec, exec.artifacts);
  }

  async list(projectId: string): Promise<ExecutionDto[]> {
    const rows = await this.prisma.testExecution.findMany({
      where: { projectId },
      include: { artifacts: true },
      orderBy: { startedAt: "desc" },
    });
    return rows.map((e) => this.toDto(e, e.artifacts));
  }

  /** R8 snapshot refetch — authoritative current state for reconnect. */
  getSnapshot(id: string): { executionId: string; events: StreamEnvelope[] } {
    return { executionId: id, events: this.snapshot.snapshot(id) };
  }

  /** WorkerGateway registers artifacts + updates status (R2 redelivery path). */
  async recordResult(input: {
    executionId: string;
    status: ExecutionStatus;
    durationMs?: number;
    failedStepId?: string;
    reportSummary?: Record<string, unknown>;
    workerJobId?: string;
  }): Promise<ExecutionDto> {
    const updated = await this.prisma.testExecution.update({
      where: { id: input.executionId },
      data: {
        status: input.status,
        durationMs: input.durationMs,
        failedStepId: input.failedStepId,
        reportSummary: input.reportSummary as never,
        workerJobId: input.workerJobId,
        finishedAt: new Date(),
      },
      include: { artifacts: true },
    });
    if (["passed", "failed", "aborted", "timeout"].includes(input.status)) {
      this.snapshot.release(input.executionId);
    }
    return this.toDto(updated, updated.artifacts);
  }

  async registerArtifact(input: {
    executionId: string;
    type: ExecutionArtifactType;
    storageRef: string;
    filename: string;
    sizeBytes: number;
    checksum: string;
    truncated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<ExecutionArtifactDto> {
    const a = await this.prisma.executionArtifact.create({
      data: {
        executionId: input.executionId,
        type: input.type,
        storageRef: input.storageRef,
        filename: input.filename,
        sizeBytes: BigInt(input.sizeBytes),
        checksum: input.checksum,
        truncated: input.truncated ?? false,
        metadata: input.metadata as never,
      },
    });
    return this.toArtifactDto(a);
  }

  private toDto = (
    e: {
      id: string;
      projectId: string;
      testCaseId: string;
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
    environment: e.environment,
    status: e.status,
    startedAt: e.startedAt.toISOString(),
    finishedAt: e.finishedAt?.toISOString(),
    durationMs: e.durationMs ?? undefined,
    failedStepId: e.failedStepId ?? undefined,
    reportSummary: (e.reportSummary as Record<string, unknown>) ?? undefined,
    workerJobId: e.workerJobId ?? undefined,
    artifacts: artifacts.map(this.toArtifactDto),
  });

  private toArtifactDto = (a: {
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
  }): ExecutionArtifactDto => ({
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
  });
}
