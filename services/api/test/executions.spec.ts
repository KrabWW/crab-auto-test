import { describe, expect, it, vi } from "vitest";
import { ExecutionsService } from "../src/modules/executions/executions.service";
import { WorkerGatewayService } from "../src/modules/worker-gateway/worker-gateway.service";

const capturedAt = new Date("2026-01-01T00:00:02.000Z");
const artifactRow = {
  id: "artifact-1",
  executionId: "exec-1",
  type: "trace" as const,
  storageRef: "worker://exec-1/trace.zip",
  filename: "trace.zip",
  sizeBytes: BigInt(4096),
  checksum: "sha256-trace",
  capturedAt,
  metadata: { browser: "chromium", retries: 0 },
  truncated: false,
};

const executionRow = {
  id: "exec-1",
  projectId: "project-a",
  testCaseId: "case-1",
  testCase: { title: "Checkout smoke" },
  createdBy: "user-a",
  environment: "local",
  status: "failed" as const,
  startedAt: new Date("2026-01-01T00:00:00.000Z"),
  finishedAt: new Date("2026-01-01T00:00:03.000Z"),
  durationMs: 3000,
  failedStepId: "step-2",
  reportSummary: { failedAssertions: 1, browser: "chromium" },
  workerJobId: "exec-1",
  artifacts: [artifactRow],
};

describe("execution reporting", () => {
  it("returns source case title, report summary, and artifact metadata after worker result persistence", async () => {
    const update = vi.fn().mockResolvedValue(executionRow);
    const snapshot = { release: vi.fn() };
    const svc = new ExecutionsService(
      { testExecution: { update } } as never,
      { record: vi.fn() } as never,
      snapshot as never,
    );

    const dto = await svc.recordResult({
      executionId: "exec-1",
      status: "failed",
      durationMs: 3000,
      failedStepId: "step-2",
      reportSummary: { failedAssertions: 1, browser: "chromium" },
      workerJobId: "exec-1",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-1" },
        data: expect.objectContaining({
          status: "failed",
          durationMs: 3000,
          failedStepId: "step-2",
          reportSummary: { failedAssertions: 1, browser: "chromium" },
          workerJobId: "exec-1",
        }),
      }),
    );
    expect(snapshot.release).toHaveBeenCalledWith("exec-1");
    expect(dto).toMatchObject({
      id: "exec-1",
      testCaseTitle: "Checkout smoke",
      reportSummary: { failedAssertions: 1, browser: "chromium" },
      artifacts: [
        {
          filename: "trace.zip",
          storageRef: "worker://exec-1/trace.zip",
          sizeBytes: 4096,
          checksum: "sha256-trace",
          metadata: { browser: "chromium", retries: 0 },
        },
      ],
    });
  });

  it("returns an authoritative project-scoped snapshot with status, artifacts, and live events", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "exec-1",
      status: "running",
      artifacts: [artifactRow],
    });
    const snapshotEvent = {
      executionId: "exec-1",
      seq: 1,
      type: "status" as const,
      stage: "running" as const,
      payload: { message: "started" },
      ts: "2026-01-01T00:00:01.000Z",
    };
    const svc = new ExecutionsService(
      { testExecution: { findFirst } } as never,
      { record: vi.fn() } as never,
      { snapshot: vi.fn().mockReturnValue([snapshotEvent]) } as never,
    );

    const dto = await svc.getSnapshot("project-a", "exec-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "exec-1", projectId: "project-a" },
      select: {
        id: true,
        status: true,
        artifacts: { orderBy: { capturedAt: "desc" } },
      },
    });
    expect(dto).toEqual({
      executionId: "exec-1",
      status: "running",
      artifacts: [
        {
          id: "artifact-1",
          executionId: "exec-1",
          type: "trace",
          storageRef: "worker://exec-1/trace.zip",
          filename: "trace.zip",
          sizeBytes: 4096,
          checksum: "sha256-trace",
          capturedAt: capturedAt.toISOString(),
          metadata: { browser: "chromium", retries: 0 },
          truncated: false,
        },
      ],
      events: [snapshotEvent],
    });
  });
});

describe("worker gateway reporting handoff", () => {
  it("passes worker result report summaries into execution persistence", async () => {
    const recordResult = vi.fn();
    const svc = new WorkerGatewayService(
      {
        testExecution: { findUnique: vi.fn().mockResolvedValue({ id: "exec-1", createdBy: "user-a" }) },
      } as never,
      { recordResult } as never,
      {} as never,
    );

    await svc.ingestMessage("user-a", {
      kind: "result",
      jobId: "exec-1",
      status: "done",
      durationMs: 1200,
      failedStepId: "step-2",
      reportSummary: { assertions: { passed: 3, failed: 0 } },
      ts: "2026-01-01T00:00:03.000Z",
    });

    expect(recordResult).toHaveBeenCalledWith({
      executionId: "exec-1",
      status: "passed",
      durationMs: 1200,
      failedStepId: "step-2",
      reportSummary: { assertions: { passed: 3, failed: 0 } },
      workerJobId: "exec-1",
    });
  });

  it("passes worker artifacts into execution artifact persistence", async () => {
    const registerArtifact = vi.fn();
    const svc = new WorkerGatewayService(
      {
        testExecution: { findUnique: vi.fn().mockResolvedValue({ id: "exec-1", createdBy: "user-a" }) },
      } as never,
      { registerArtifact } as never,
      {} as never,
    );

    await svc.ingestMessage("user-a", {
      kind: "artifacts",
      jobId: "exec-1",
      ts: "2026-01-01T00:00:02.000Z",
      artifacts: [
        {
          type: "log",
          filename: "worker.log",
          sizeBytes: 512,
          checksum: "sha256-log",
          capturedAt: "2026-01-01T00:00:02.000Z",
          metadata: { lines: 10 },
          truncated: true,
        },
      ],
    });

    expect(registerArtifact).toHaveBeenCalledWith({
      executionId: "exec-1",
      type: "log",
      storageRef: "worker://exec-1/worker.log",
      filename: "worker.log",
      sizeBytes: 512,
      checksum: "sha256-log",
      truncated: true,
      metadata: { lines: 10 },
    });
  });
});
