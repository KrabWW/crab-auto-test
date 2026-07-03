import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ExecutionsService } from "../src/modules/executions/executions.service";
import { rollupSuiteStatus, TestSuitesService } from "../src/modules/test-suites/test-suites.service";
import { WorkerGatewayService } from "../src/modules/worker-gateway/worker-gateway.service";

describe("test-suite run rollup", () => {
  it("passes only when every case execution passed", () => {
    expect(rollupSuiteStatus(["passed", "passed"], "running")).toBe("passed");
    expect(rollupSuiteStatus(["passed", "failed"], "running")).toBe("failed");
  });

  it("stays non-terminal while no case execution is done", () => {
    expect(rollupSuiteStatus(["running", "queued"], "queued")).toBe("running");
    expect(rollupSuiteStatus(["queued", "queued"], "queued")).toBe("queued");
  });

  it("marks a partially completed suite when some case executions are unfinished", () => {
    expect(rollupSuiteStatus(["passed", "queued"], "running")).toBe("partial");
    expect(rollupSuiteStatus(["failed", "running"], "running")).toBe("partial");
  });

  it("preserves an aborted suite run", () => {
    expect(rollupSuiteStatus(["passed", "queued"], "aborted")).toBe("aborted");
    expect(rollupSuiteStatus(["passed", "aborted"], "running")).toBe("aborted");
    expect(rollupSuiteStatus(["aborted", "queued"], "running")).toBe("aborted");
  });

  it("does not turn an empty run into a false success", () => {
    expect(rollupSuiteStatus([], "running")).toBe("queued");
  });
});

describe("suite run creation", () => {
  it("does not persist a suite run when the first child execution cannot be created", async () => {
    const suiteRunCreate = vi.fn();
    const svc = new TestSuitesService(
      {
        testSuite: {
          findFirst: vi.fn().mockResolvedValue({
            id: "suite-1",
            projectId: "project-a",
            cases: [{ testCaseId: "case-a", order: 1 }],
          }),
        },
        $transaction: vi.fn((cb) =>
          cb({
            testExecution: {
              create: vi.fn().mockRejectedValue(new BadRequestException("case unavailable")),
            },
            suiteRun: { create: suiteRunCreate },
          }),
        ),
      } as never,
      { record: vi.fn() } as never,
    );

    await expect(
      svc.createRun("project-a", "suite-1", "runner-a", { environment: "local" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(suiteRunCreate).not.toHaveBeenCalled();
  });
});

describe("suite run project scoping", () => {
  it("loads child executions only from the suite run project", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "exec-owned",
        projectId: "project-a",
        testCaseId: "case-a",
        createdBy: "runner-a",
        environment: "suite",
        status: "passed",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        finishedAt: new Date("2026-01-01T00:00:01.000Z"),
        durationMs: 1000,
        failedStepId: null,
        reportSummary: null,
        workerJobId: null,
        artifacts: [],
      },
    ]);
    const svc = new TestSuitesService(
      {
        suiteRun: {
          findFirst: vi.fn().mockResolvedValue({
            id: "run-a",
            projectId: "project-a",
            suiteId: "suite-a",
            environment: "suite",
            status: "running",
            executionIds: ["exec-owned", "exec-foreign"],
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            finishedAt: null,
            durationMs: null,
            createdBy: "runner-a",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
          update: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "run-a",
              projectId: "project-a",
              suiteId: "suite-a",
              environment: "suite",
              status: data.status,
              executionIds: ["exec-owned", "exec-foreign"],
              startedAt: new Date("2026-01-01T00:00:00.000Z"),
              finishedAt: data.finishedAt ?? null,
              durationMs: data.durationMs ?? null,
              createdBy: "runner-a",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
          ),
        },
        testExecution: { findMany },
      } as never,
      { record: vi.fn() } as never,
    );

    const dto = await svc.getRun("project-a", "run-a");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["exec-owned", "exec-foreign"] }, projectId: "project-a" },
      }),
    );
    expect(dto.executions).toHaveLength(1);
    expect(dto.executions[0]!.id).toBe("exec-owned");
  });
});

describe("execution creation guard used by suite runs", () => {
  it("rejects cross-project test-case execution", async () => {
    const svc = new ExecutionsService(
      { testCase: { findFirst: vi.fn().mockResolvedValue(null) } } as never,
      { record: vi.fn() } as never,
      { register: vi.fn() } as never,
    );

    await expect(
      svc.create("project-a", "user-a", { testCaseId: "case-b", environment: "suite" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores the requesting user as execution owner", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "exec-1",
      projectId: "project-a",
      testCaseId: "case-a",
      createdBy: "runner-a",
      environment: "suite",
      status: "queued",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
      durationMs: null,
      failedStepId: null,
      reportSummary: null,
      workerJobId: null,
      artifacts: [],
    });
    const svc = new ExecutionsService(
      {
        testCase: { findFirst: vi.fn().mockResolvedValue({ id: "case-a" }) },
        testExecution: { create },
      } as never,
      { record: vi.fn() } as never,
      { register: vi.fn() } as never,
    );

    const dto = await svc.create("project-a", "runner-a", {
      testCaseId: "case-a",
      environment: "suite",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: "runner-a" }),
      }),
    );
    expect(dto.createdBy).toBe("runner-a");
  });
});

describe("execution project scoping", () => {
  it("does not read an execution through the wrong project route", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const svc = new ExecutionsService(
      { testExecution: { findFirst } } as never,
      { record: vi.fn() } as never,
      { snapshot: vi.fn() } as never,
    );

    await expect(svc.get("project-a", "exec-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-b", projectId: "project-a" },
      }),
    );
  });

  it("does not expose a snapshot through the wrong project route", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const svc = new ExecutionsService(
      { testExecution: { findFirst } } as never,
      { record: vi.fn() } as never,
      { snapshot: vi.fn() } as never,
    );

    await expect(svc.getSnapshot("project-a", "exec-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "exec-b", projectId: "project-a" },
      select: { id: true },
    });
  });
});

describe("worker claim ownership filtering", () => {
  it("claims the oldest job owned by the worker user without blocking on foreign jobs", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "exec-owned",
        projectId: "project-a",
        testCaseId: "case-a",
        createdBy: "runner-a",
        environment: "suite",
      });
    const send = vi.fn();
    const svc = new WorkerGatewayService(
      {
        testExecution: {
          findFirst,
          update: vi.fn(),
        },
        testCase: {
          findUnique: vi.fn().mockResolvedValue({
            projectId: "project-a",
            steps: [{ id: "step-1", order: 1, action: "open", expectedResult: "ok", data: null }],
          }),
        },
      } as never,
      {} as never,
      {} as never,
    );

    const job = await svc.claimAndDispatch("runner-a", send);

    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { status: "dispatched", createdBy: "runner-a" },
      }),
    );
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { status: "queued", createdBy: "runner-a" },
      }),
    );
    expect(job?.executionId).toBe("exec-owned");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: "dispatch" }));
  });
});
