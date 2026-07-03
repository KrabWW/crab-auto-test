import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ExecutionsService } from "../executions/executions.service";
import { SnapshotService } from "../../infra/streaming/snapshot.service";
import type {
  WorkerJob,
  WorkerMessage,
  BackendToWorkerMessage,
  WorkerArtifactMeta,
  ExecutionStatus,
} from "@crab/shared-types";

/**
 * automation-workers.1–4 + R2 + R3.
 *
 * R2: authenticated long-lived session stream (NOT BullMQ transport).
 *     Jobs persist queued→dispatched→running→done; on reconnect, re-deliver
 *     dispatched-but-unacked exactly-once (MUST-5).
 * R3: per-user worker token; reject results for jobs not owned by token user.
 */
@Injectable()
export class WorkerGatewayService {
  private readonly logger = new Logger(WorkerGatewayService.name);
  /** Active subscriber callbacks per executionId (live window only, R8). */
  private readonly subscribers = new Map<
    string,
    Set<(m: BackendToWorkerMessage) => void>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly executions: ExecutionsService,
    private readonly snapshot: SnapshotService,
  ) {}

  /**
   * Claim the next queued execution for this user's worker and dispatch it.
   * R2 redelivery: also re-claims a `dispatched`-but-unacked job (a worker that
   * disconnected after dispatch but before ack). MUST-5 exactly-once: the job
   * only flips to `running` on ack, so re-dispatch is idempotent — the worker
   * re-executes and the backend does not duplicate canonical writes.
   */
  async claimAndDispatch(
    userId: string,
    send: (m: BackendToWorkerMessage) => void,
  ): Promise<WorkerJob | null> {
    // Re-deliver dispatched-unacked first (oldest), then fresh queued jobs.
    const exec =
      (await this.prisma.testExecution.findFirst({
        where: { status: "dispatched", createdBy: userId },
        orderBy: { startedAt: "asc" },
      })) ??
      (await this.prisma.testExecution.findFirst({
        where: { status: "queued", createdBy: userId },
        orderBy: { startedAt: "asc" },
      }));
    if (!exec) return null;

    // R3: ownership — only the user who created the execution may claim.
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: exec.testCaseId },
      select: { projectId: true, steps: { orderBy: { order: "asc" } } },
    });
    if (!testCase) throw new NotFoundException("Test case for execution missing");

    await this.prisma.testExecution.update({
      where: { id: exec.id },
      data: { status: "dispatched" },
    });

    const job: WorkerJob = {
      jobId: exec.id,
      executionId: exec.id,
      projectId: exec.projectId,
      testCaseId: exec.testCaseId,
      environment: exec.environment,
      timeoutMs: 60_000,
      networkPolicy: { mode: "allow-list", hosts: ["localhost", "127.0.0.1"] },
      resourceLimits: {
        memoryMb: 512,
        cpuPercent: 50,
        concurrency: 1,
        artifactMaxBytes: 10 * 1024 * 1024,
      },
      steps: testCase.steps.map((s) => ({
        stepId: s.id,
        order: s.order,
        action: s.action,
        expectedResult: s.expectedResult ?? undefined,
        data: s.data as unknown,
      })),
      ts: new Date().toISOString(),
    };

    this.subscribers.set(exec.id, (this.subscribers.get(exec.id) ?? new Set()).add(send));
    send({ kind: "dispatch", job });
    return job;
  }

  /** Ingest a worker message; enforce R3 ownership + R2 lifecycle. */
  async ingestMessage(userId: string, msg: WorkerMessage): Promise<void> {
    const exec = await this.prisma.testExecution.findUnique({
      where: { id: msg.jobId },
    });
    if (!exec) throw new NotFoundException("Execution not found");

    // R3 ownership check.
    if (exec.createdBy !== userId) {
      throw new ForbiddenException("WORKER_JOB_NOT_OWNED");
    }

    switch (msg.kind) {
      case "ack":
        await this.prisma.testExecution.update({
          where: { id: msg.jobId },
          data: { status: "running" },
        });
        break;
      case "heartbeat":
        // liveness only; no state change unless terminal
        break;
      case "logs":
        // logs are redacted by worker (SEC-PW-4); store as artifact metadata
        break;
      case "result":
        await this.executions.recordResult({
          executionId: msg.jobId,
          status: this.toExecutionStatus(msg.status),
          durationMs: msg.durationMs,
          failedStepId: msg.failedStepId,
          reportSummary: msg.reportSummary as Record<string, unknown> | undefined,
          workerJobId: msg.jobId,
        });
        this.notify(msg.jobId, { kind: "cancel", jobId: msg.jobId, ts: msg.ts });
        this.subscribers.delete(msg.jobId);
        break;
      case "artifacts":
        for (const a of msg.artifacts) await this.registerArtifact(msg.jobId, a);
        break;
    }
  }

  private toExecutionStatus(status: "done" | "timeout" | "aborted"): ExecutionStatus {
    return status === "done" ? "passed" : status;
  }

  private async registerArtifact(executionId: string, meta: WorkerArtifactMeta) {
    await this.executions.registerArtifact({
      executionId,
      type: meta.type,
      storageRef: meta.storageRef ?? `worker://${executionId}/${meta.filename}`,
      filename: meta.filename,
      sizeBytes: meta.sizeBytes,
      checksum: meta.checksum,
      truncated: meta.truncated,
      metadata: meta.metadata,
    });
  }

  private notify(executionId: string, m: BackendToWorkerMessage) {
    const subs = this.subscribers.get(executionId);
    if (subs) for (const s of subs) s(m);
  }
}
