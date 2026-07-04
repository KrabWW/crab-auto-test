import { expect, test, type Page } from "@playwright/test";
import type { ProjectDto, SuiteRunDto, TestCaseDto, TestSuiteDto } from "@crab/shared-types";
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

async function seedCases(token: string) {
  const slug = uniqueSlug("suite");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Suite ${slug}`, slug }),
  });
  const mod = await api<{ id: string }>(`/projects/${project.id}/modules`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: "Suite smoke", order: 0 }),
  });
  const cases: TestCaseDto[] = [];
  for (const title of ["Login happy path", "Login bad password", "Logout"]) {
    cases.push(
      await api<TestCaseDto>(`/projects/${project.id}/test-cases`, {
        method: "POST",
        token,
        body: JSON.stringify({
          moduleId: mod.id,
          title: `${title} ${slug}`,
          priority: "high",
          steps: [{ order: 1, action: "open page", expectedResult: "loaded" }],
        }),
      }),
    );
  }
  return { project, cases };
}

async function checkCase(page: Page, title: string) {
  await page.locator("label", { hasText: title }).locator("input").check();
}

test("test suites: create, edit members, delete, run summary", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const { project, cases } = await seedCases(token);

  await page.goto(`/projects/${project.id}/test-suites`);
  await expect(page.getByRole("heading", { name: "Test Suites" })).toBeVisible();

  await page.getByRole("button", { name: "New suite" }).click();
  await page.getByPlaceholder("Suite name").fill("Smoke suite");
  await page.getByPlaceholder("Description").fill("Fast checks");
  await checkCase(page, cases[0]!.title);
  await checkCase(page, cases[1]!.title);
  await page.getByRole("button", { name: "Create suite" }).click();
  await expect(page.getByRole("button", { name: /Smoke suite/ })).toBeVisible();

  await page.getByLabel("Suite name").fill("Smoke suite edited");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("button", { name: /Smoke suite edited/ })).toBeVisible();

  await page.getByLabel("Add test case").selectOption(cases[2]!.id);
  await page.getByRole("button", { name: "Add case" }).click();
  await page.getByRole("button", { name: "Save members" }).click();
  await expect
    .poll(async () => {
      const [suite] = await api<TestSuiteDto[]>(`/projects/${project.id}/test-suites`, { token });
      return suite?.cases.map((item) => item.testCaseId) ?? [];
    })
    .toEqual([cases[0]!.id, cases[1]!.id, cases[2]!.id]);

  const [suite] = await api<TestSuiteDto[]>(`/projects/${project.id}/test-suites`, { token });
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes(`/projects/${project.id}/test-suites/${suite!.id}`),
  );
  await page.getByTestId("delete-suite").click();
  await page.getByTestId("confirm-action").click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect
    .poll(async () => (await api<TestSuiteDto[]>(`/projects/${project.id}/test-suites`, { token })).length)
    .toBe(0);
  await expect(page.getByText(/No test suites yet/)).toBeVisible();

  const runSuite = await api<TestSuiteDto>(`/projects/${project.id}/test-suites`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: "Run suite",
      cases: cases.map((testCase, index) => ({ testCaseId: testCase.id, order: index + 1 })),
    }),
  });
  const run = await api<SuiteRunDto>(`/projects/${project.id}/test-suites/${runSuite.id}/runs`, {
    method: "POST",
    token,
    body: JSON.stringify({ environment: "e2e" }),
  });
  expect(run.executionIds).toHaveLength(3);

  await page.reload();
  await page.getByTestId("run-suite").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByText(/3 executions/)).toBeVisible();
  await expect(page.locator(`a[href^="/projects/${project.id}/executions/"]`).first()).toBeVisible();
});
