import { expect, test } from "@playwright/test";
import type { ExecutionDto, ExecutionSnapshot, ProjectDto, TestCaseDto } from "@crab/shared-types";
import { API_BASE, injectSession, loginViaApi, uniqueSlug } from "./_helpers";

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`${res.status} ${path}: ${body.message ?? res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

test("execution reports: queue stats, detail summary, artifacts, and snapshot", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("exec-report");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Execution Report ${slug}`, slug }),
  });
  const mod = await api<{ id: string }>(`/projects/${project.id}/modules`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: "Execution smoke", order: 0 }),
  });
  const testCase = await api<TestCaseDto>(`/projects/${project.id}/test-cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      moduleId: mod.id,
      title: `Checkout report ${slug}`,
      priority: "high",
      steps: [{ order: 1, action: "open checkout", expectedResult: "checkout loads" }],
    }),
  });
  const queued = await api<ExecutionDto>(`/projects/${project.id}/executions`, {
    method: "POST",
    token,
    body: JSON.stringify({ testCaseId: testCase.id, environment: "local-chromium" }),
  });

  const listLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/executions`),
  );
  await page.goto(`/projects/${project.id}/executions`);
  await listLoad;
  await expect(page.getByRole("heading", { name: "Executions" })).toBeVisible();
  await expect(page.getByTestId("execution-stats")).toContainText("Queued");
  await expect(page.getByTestId(`execution-row-${queued.id}`)).toContainText(`Checkout report ${slug}`);

  const artifact = {
    id: "artifact-ui-1",
    executionId: queued.id,
    type: "trace" as const,
    storageRef: `worker://${queued.id}/trace.zip`,
    filename: "trace.zip",
    sizeBytes: 4096,
    checksum: "sha256-trace",
    capturedAt: "2026-01-01T00:00:02.000Z",
    metadata: { browser: "chromium", retries: 0 },
    truncated: false,
  };
  const report: ExecutionDto = {
    ...queued,
    status: "failed",
    durationMs: 1800,
    failedStepId: "step-1",
    workerJobId: queued.id,
    reportSummary: { failedAssertions: 1, browser: "chromium" },
    artifacts: [artifact],
  };
  const snapshot: ExecutionSnapshot = {
    executionId: queued.id,
    status: "failed",
    artifacts: [artifact],
    events: [
      {
        executionId: queued.id,
        seq: 1,
        type: "status",
        stage: "running",
        payload: { message: "worker started" },
        ts: "2026-01-01T00:00:01.000Z",
      },
    ],
  };

  await page.route(new RegExp(`/api/v1/projects/${project.id}/executions/${queued.id}$`), async (route) => {
    await route.fulfill({ json: report });
  });
  await page.route(new RegExp(`/api/v1/projects/${project.id}/executions/${queued.id}/snapshot$`), async (route) => {
    await route.fulfill({ json: snapshot });
  });

  await page.getByTestId(`execution-row-${queued.id}`).click();
  await expect(page.getByTestId("execution-detail")).toContainText("Execution Report");
  await expect(page.getByTestId("execution-detail")).toContainText("failed");
  await expect(page.getByTestId("execution-report-summary")).toContainText("failedAssertions");
  await expect(page.getByTestId("execution-report-summary")).toContainText("chromium");
  await expect(page.getByTestId("execution-artifacts")).toContainText("trace.zip");
  await expect(page.getByTestId("execution-artifacts")).toContainText("sha256-trace");
  await expect(page.getByTestId("execution-snapshot")).toContainText("Events: 1");
  await expect(page.getByTestId("execution-snapshot")).toContainText("#1 status");
});
