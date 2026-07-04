import { test, expect, type Page } from "@playwright/test";
import type { ExecutionDto, ProjectDto, TestCaseDto } from "@crab/shared-types";
import { API_BASE, injectSession, loginViaApi, uniqueSlug } from "./_helpers";

/**
 * Project workspace e2e smoke (TDD).
 *
 * Defines the DOM contract for the workspace shell implemented by
 * task #9 (ProjectWorkspaceNav.vue + [id].vue refactor) and task #10
 * (overview home + useProjectOverview composable + empty states).
 *
 * Contract (per lead): nav role, overview heading, stat data-testids,
 * empty-state. Nav entries are asserted by accessible name (role+name),
 * not testid — testids are reserved for the stat cards and the overview
 * region, matching the repo convention (projects.spec.ts / auth-login.spec.ts
 * use role+name throughout).
 *
 * Auth + project bootstrap reuse _helpers (injectSession / loginViaApi /
 * uniqueSlug). The explicit-token fetch wrapper mirrors tracer-bullet.spec.ts:
 * the composables api client reads the auth token from localStorage on the
 * client only, so it cannot drive authenticated requests from the Node test
 * context — a token-bearing fetch is the established pattern.
 */
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

/** Log in + create a fresh project; the browser is authed separately via injectSession. */
async function bootstrapProject(): Promise<{ token: string; project: ProjectDto }> {
  const token = await loginViaApi();
  const slug = uniqueSlug("e2e-ws");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `WS E2E ${slug}`, slug }),
  });
  return { token, project };
}

async function seedExecutableCase(token: string, projectId: string, slug: string) {
  const mod = await api<{ id: string }>(`/projects/${projectId}/modules`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Workspace module ${slug}`, order: 0 }),
  });
  const testCase = await api<TestCaseDto>(`/projects/${projectId}/test-cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      moduleId: mod.id,
      title: `Workspace case ${slug}`,
      priority: "high",
      steps: [{ order: 1, action: "open page", expectedResult: "loaded" }],
    }),
  });
  const execution = await api<ExecutionDto>(`/projects/${projectId}/executions`, {
    method: "POST",
    token,
    body: JSON.stringify({ testCaseId: testCase.id, environment: "workspace" }),
  });
  return { testCase, execution };
}

test.describe("project workspace", () => {
  test("workspace nav renders project-scoped entries and routes to overview", async ({
    page,
  }: {
    page: Page;
  }) => {
    await injectSession(page);
    const { project } = await bootstrapProject();
    const id = project.id;

    await page.goto(`/projects/${id}`);

    // The project-scoped workspace nav exposes a navigation role with an
    // accessible name (aria-label="Project workspace" on <nav>).
    const nav = page.getByRole("navigation", { name: "Project workspace" });
    await expect(nav).toBeVisible();

    // Every workspace tab is rendered as a link with its accessible name.
    for (const label of [
      "Requirements",
      "AI Generation",
      "Test Cases",
      "Test Suites",
      "API Automation",
      "Executions",
      "Knowledge",
      "Settings",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

    await expect(nav.getByRole("link").first()).toContainText("Requirements");

    // A tab routes away from the overview home.
    await nav.getByRole("link", { name: "Test Cases" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}/test-cases$`));

    // The Overview entry returns to the project root and mounts the overview.
    await page.getByTestId("nav-overview").click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
    await expect(page.getByTestId("project-overview")).toBeVisible();
  });

  test("overview home shows project-name heading and stat cards", async ({
    page,
  }: {
    page: Page;
  }) => {
    await injectSession(page);
    const { token, project } = await bootstrapProject();
    await seedExecutableCase(token, project.id, uniqueSlug("ws-case"));

    await page.goto(`/projects/${project.id}`);

    // Heading surfaces the project name.
    await expect(page.getByTestId("overview-heading")).toContainText(project.name);

    // Stat cards carry stable data-testids (kebab-case, keyed by stat).
    for (const stat of ["stat-test-cases", "stat-executions", "stat-api-cases", "stat-knowledge-bases"]) {
      await expect(page.getByTestId(stat)).toBeVisible();
    }
    await expect(page.getByTestId("stat-test-cases")).toContainText("1");
    await expect(page.getByTestId("stat-executions")).toContainText("1");
    await expect(page.getByText("Requirement-first workspace")).toBeVisible();
    await expect(page.getByText("Requirement-first acceptance route")).toBeVisible();
    await expect(page.getByText("Module readiness")).toBeVisible();
  });

  test("fresh project shows a start-here path linking to Requirements", async ({
    page,
  }: {
    page: Page;
  }) => {
    await injectSession(page);
    const { project } = await bootstrapProject();
    const id = project.id;

    await page.goto(`/projects/${id}`);

    // A brand-new project has 0 assets → first-run guidance.
    await expect(page.getByText("No workspace evidence yet")).toBeVisible();
    await expect(page.getByText("Requirement-first acceptance route")).toBeVisible();
    const link = page.getByRole("link", { name: "Capture first requirement" }).first();
    await expect(link).toHaveAttribute("href", new RegExp(`/projects/${id}/requirements`));
  });

  test("workspace summary failure is visible and recoverable", async ({ page }: { page: Page }) => {
    await injectSession(page);
    const { project } = await bootstrapProject();
    await page.route(`**/api/v1/projects/${project.id}/workspace-summary`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "summary unavailable" }),
      });
    });

    await page.goto(`/projects/${project.id}`);

    await expect(page.getByTestId("workspace-summary-error")).toContainText("Workspace summary unavailable");
    await expect(page.getByTestId("workspace-summary-error")).toContainText("summary unavailable");
  });

  test("overview does not carry counts across project route changes", async ({ page }: { page: Page }) => {
    await injectSession(page);
    const { token, project: projectWithData } = await bootstrapProject();
    await seedExecutableCase(token, projectWithData.id, uniqueSlug("ws-route-a"));
    const projectWithoutData = await api<ProjectDto>("/projects", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "Workspace Route Empty", slug: uniqueSlug("ws-route-b") }),
    });

    await page.goto(`/projects/${projectWithData.id}`);
    await expect(page.getByTestId("stat-test-cases")).toContainText("1");
    await page.goto(`/projects/${projectWithoutData.id}`);
    await expect(page.getByTestId("stat-test-cases")).toContainText("0");
    await expect(page.getByTestId("stat-executions")).toContainText("0");
  });

  test("workspace nav keeps the parent tab active on detail routes", async ({ page }: { page: Page }) => {
    await injectSession(page);
    const { token, project } = await bootstrapProject();
    const { execution } = await seedExecutableCase(token, project.id, uniqueSlug("ws-detail"));

    await page.goto(`/projects/${project.id}/executions/${execution.id}`);

    await expect(page.getByRole("navigation", { name: "Project workspace" }).getByRole("link", { name: "Executions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
