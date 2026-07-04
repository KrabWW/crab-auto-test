import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ApiScenariosService } from "../src/modules/api-automation/api-scenarios.service";

function makeService(prisma: Record<string, unknown>, apiAutomation: Record<string, unknown> = {}) {
  return new ApiScenariosService(prisma as never, { record: vi.fn() } as never, apiAutomation as never);
}

describe("api scenarios", () => {
  it("create rejects empty name", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "", steps: [{ caseId: "c", order: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects empty or duplicate steps", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "S", steps: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.create("p", "u", {
        name: "S",
        steps: [
          { caseId: "c1", order: 1 },
          { caseId: "c1", order: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects duplicate step order", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", {
        name: "S",
        steps: [
          { caseId: "c1", order: 1 },
          { caseId: "c2", order: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects cross-project cases", async () => {
    const svc = makeService({
      apiTestCase: { count: vi.fn().mockResolvedValue(1) },
    });
    await expect(
      svc.create("p", "u", {
        name: "S",
        steps: [
          { caseId: "c1", order: 1 },
          { caseId: "c2", order: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create persists scenario and ordered steps", async () => {
    const created = {
      id: "sc-1",
      projectId: "p",
      name: "Smoke",
      description: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { id: "step-1", scenarioId: "sc-1", caseId: "c1", order: 1, case: { id: "c1", name: "Login", method: "POST", url: "/login" } },
      ],
    };
    const prisma = {
      apiTestCase: { count: vi.fn().mockResolvedValue(1) },
      apiScenario: { create: vi.fn().mockResolvedValue(created) },
    };
    const svc = makeService(prisma);
    const dto = await svc.create("p", "u", {
      name: "Smoke",
      steps: [{ caseId: "c1", order: 1 }],
    });
    expect(dto.id).toBe("sc-1");
    expect(dto.steps).toHaveLength(1);
    expect(dto.steps[0]!.case?.method).toBe("POST");
  });

  it("delete refuses when runs exist", async () => {
    const svc = makeService({
      apiScenario: {
        findFirst: vi.fn().mockResolvedValue({ id: "sc-1", _count: { runs: 3 } }),
      },
    });
    await expect(svc.delete("p", "sc-1", "u")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("get 404 when scenario is cross-project", async () => {
    const svc = makeService({
      apiScenario: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.get("p", "sc-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("runScenario builds a passing summary when every step passes", async () => {
    const scenario = {
      id: "sc-1",
      projectId: "p",
      name: "Smoke",
      description: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { id: "step-1", scenarioId: "sc-1", caseId: "c1", order: 1, case: { id: "c1", name: "Login", method: "POST", url: "/login" } },
        { id: "step-2", scenarioId: "sc-1", caseId: "c2", order: 2, case: { id: "c2", name: "Logout", method: "POST", url: "/logout" } },
      ],
    };
    const runRow = {
      id: "run-1",
      projectId: "p",
      scenarioId: "sc-1",
      environmentId: null,
      environmentName: null,
      status: "passed",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 250,
      summary: { totalSteps: 2, executedSteps: 2, passed: 2, failed: 0, errored: 0 },
      createdBy: "u",
      createdAt: new Date(),
      executions: [
        { id: "exec-1", caseId: "c1", status: "passed", startedAt: new Date(), finishedAt: new Date(), durationMs: 100, responseStatus: 200, assertionResults: [], extractedVariables: {}, scenarioStepIndex: 0 },
        { id: "exec-2", caseId: "c2", status: "passed", startedAt: new Date(), finishedAt: new Date(), durationMs: 150, responseStatus: 200, assertionResults: [], extractedVariables: {}, scenarioStepIndex: 1 },
      ],
    };
    const prisma = {
      apiScenario: { findFirst: vi.fn().mockResolvedValue(scenario) },
      apiScenarioRun: {
        create: vi.fn().mockResolvedValue({ id: "run-1", projectId: "p", scenarioId: "sc-1", environmentId: null, environmentName: null, status: "running", startedAt: new Date(), finishedAt: null, durationMs: null, summary: null, createdBy: "u", createdAt: new Date() }),
        update: vi.fn().mockResolvedValue(runRow),
      },
      apiExecution: {
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `exec-${data.scenarioStepIndex! + 1}`,
            caseId: scenario.steps[data.scenarioStepIndex!]!.caseId,
            status: "passed",
            startedAt: new Date(),
            finishedAt: new Date(),
            durationMs: 100,
            responseStatus: 200,
            assertionResults: [],
            extractedVariables: {},
            scenarioStepIndex: data.scenarioStepIndex,
          }),
        ),
      },
    };
    const apiAutomation = {
      runCase: vi.fn().mockImplementation((_p: string, caseId: string) =>
        Promise.resolve({ id: `exec-fresh-${caseId}`, caseId, status: "passed" }),
      ),
    };
    const svc = makeService(prisma, apiAutomation);
    const dto = await svc.runScenario("p", "sc-1", "u", {});
    expect(dto.status).toBe("passed");
    expect(dto.summary?.passed).toBe(2);
    expect(dto.executions).toHaveLength(2);
  });

  it("runScenario 400 when scenario has no steps", async () => {
    const svc = makeService({
      apiScenario: { findFirst: vi.fn().mockResolvedValue({ id: "sc-1", projectId: "p", steps: [] }) },
    });
    await expect(svc.runScenario("p", "sc-1", "u", {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
