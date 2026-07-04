import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProjectsService } from "../src/modules/projects/projects.service";

function makeService(prisma: Record<string, unknown>) {
  return new ProjectsService(prisma as never, { record: vi.fn() } as never);
}

describe("project workspace summary", () => {
  it("returns project-scoped counts for the workspace overview", async () => {
    const testExecutionCount = vi.fn()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    const requirementCount = vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    const mcpToolCount = vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    const skillInstallationCount = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    const prisma = {
      project: { findUnique: vi.fn().mockResolvedValue({ id: "project-a" }) },
      testCase: { count: vi.fn().mockResolvedValue(8) },
      testSuite: { count: vi.fn().mockResolvedValue(2) },
      testExecution: { count: testExecutionCount },
      apiTestCase: { count: vi.fn().mockResolvedValue(3) },
      apiExecution: { count: vi.fn().mockResolvedValue(4) },
      requirement: { count: requirementCount },
      knowledgeBase: { count: vi.fn().mockResolvedValue(2) },
      document: { count: vi.fn().mockResolvedValue(7) },
      chatSession: { count: vi.fn().mockResolvedValue(3) },
      mcpTool: { count: mcpToolCount },
      skillInstallation: { count: skillInstallationCount },
    };
    const svc = makeService(prisma);

    const dto = await svc.getWorkspaceSummary("project-a");

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: "project-a" },
      select: { id: true },
    });
    expect(prisma.testCase.count).toHaveBeenCalledWith({ where: { projectId: "project-a" } });
    expect(prisma.testSuite.count).toHaveBeenCalledWith({ where: { projectId: "project-a" } });
    expect(prisma.testExecution.count).toHaveBeenNthCalledWith(1, { where: { projectId: "project-a" } });
    expect(prisma.testExecution.count).toHaveBeenNthCalledWith(2, {
      where: { projectId: "project-a", status: "queued" },
    });
    expect(prisma.testExecution.count).toHaveBeenNthCalledWith(3, {
      where: { projectId: "project-a", status: "failed" },
    });
    expect(prisma.document.count).toHaveBeenCalledWith({
      where: { knowledgeBase: { projectId: "project-a" } },
    });
    expect(prisma.mcpTool.count).toHaveBeenNthCalledWith(2, {
      where: { projectId: "project-a", status: "approved" },
    });
    expect(prisma.skillInstallation.count).toHaveBeenNthCalledWith(2, {
      where: { projectId: "project-a", state: "installed" },
    });
    expect(dto).toMatchObject({
      projectId: "project-a",
      counts: {
        testCases: 8,
        testSuites: 2,
        executions: 5,
        queuedExecutions: 1,
        failedExecutions: 1,
        apiCases: 3,
        apiExecutions: 4,
        requirements: 6,
        approvedRequirements: 2,
        knowledgeBases: 2,
        knowledgeDocuments: 7,
        chatSessions: 3,
        mcpTools: 4,
        approvedMcpTools: 1,
        skills: 5,
        enabledSkills: 4,
      },
    });
    expect(new Date(dto.generatedAt).toString()).not.toBe("Invalid Date");
  });

  it("rejects missing projects before counting related data", async () => {
    const count = vi.fn();
    const svc = makeService({
      project: { findUnique: vi.fn().mockResolvedValue(null) },
      testCase: { count },
    });

    await expect(svc.getWorkspaceSummary("missing-project")).rejects.toBeInstanceOf(NotFoundException);
    expect(count).not.toHaveBeenCalled();
  });
});
