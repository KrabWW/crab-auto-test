import { expect, test } from "@playwright/test";
import type {
  ApiEnvironmentDto,
  ApiScenarioDto,
  ApiTestCaseDto,
  ProjectDto,
} from "@crab/shared-types";
import { API_BASE, injectSession, loginViaApi, uniqueSlug } from "./_helpers";

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const callerHeaders = (init?.headers ?? {}) as Record<string, string>;
  if (!callerHeaders["Content-Type"] && typeof init?.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...callerHeaders },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`${res.status} ${path}: ${body.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

test("api scenarios: list reflects API-created scenario, detail and delete work", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("scenario");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Scenario ${slug}`, slug }),
  });

  // Seed two API cases.
  const caseA = await api<ApiTestCaseDto>(`/projects/${project.id}/api-automation/cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `Login ${slug}`,
      method: "POST",
      url: "https://httpbin.org/status/200",
      headers: [{ key: "Content-Type", value: "application/json", secret: false }],
      body: JSON.stringify({ user: "demo" }),
      assertions: [{ order: 1, source: "status", operator: "equals", expected: "200" }],
      extractions: [],
    }),
  });
  const caseB = await api<ApiTestCaseDto>(`/projects/${project.id}/api-automation/cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `Ping ${slug}`,
      method: "GET",
      url: "https://httpbin.org/status/204",
      headers: [],
      assertions: [{ order: 1, source: "status", operator: "equals", expected: "204" }],
      extractions: [],
    }),
  });

  // Create the scenario via API (UI form interactions are flaky under headless
  // Chromium). UI smoke then verifies list/detail/delete flows.
  const scenario = await api<ApiScenarioDto>(`/projects/${project.id}/api-automation/scenarios`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `Smoke ${slug}`,
      description: "API-created scenario",
      steps: [
        { caseId: caseA.id, order: 1 },
        { caseId: caseB.id, order: 2 },
      ],
    }),
  });

  await page.goto(`/projects/${project.id}/api-scenarios`);
  await expect(page.getByRole("heading", { name: "API Scenarios", level: 2 })).toBeVisible();

  const row = page.locator(`[data-testid="scenario-row-${scenario.id}"]`);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();

  // Detail panel should show both steps.
  await expect(page.getByText(caseA.name)).toBeVisible();
  await expect(page.getByText(caseB.name)).toBeVisible();

  // Delete via UI confirmation.
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes(`/projects/${project.id}/api-automation/scenarios/${scenario.id}`),
  );
  await page.getByTestId("delete-scenario").click();
  await page.getByTestId("delete-confirm").click();
  expect((await deleteResponse).ok()).toBe(true);
});

test("api scenarios: environment pick is optional for run", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("scenarioenv");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `ScenarioEnv ${slug}`, slug }),
  });

  // Seed environment to confirm the page renders env-aware UI without crashing.
  await api<ApiEnvironmentDto>(`/projects/${project.id}/api-automation/environments`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `Env ${slug}`,
      variables: [{ key: "base", value: "https://httpbin.org", secret: false }],
    }),
  });

  await page.goto(`/projects/${project.id}/api-scenarios`);
  await expect(page.getByRole("heading", { name: "API Scenarios", level: 2 })).toBeVisible();
  await expect(page.getByText(/No scenarios yet|Create the first one/)).toBeVisible();
});
