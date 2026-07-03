import { test, expect, type Page } from "@playwright/test";
import type { ProjectDto } from "@crab/shared-types";
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
      "Test Cases",
      "Executions",
      "AI Generation",
      "Knowledge",
      "API Automation",
      "Settings",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

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
    const { project } = await bootstrapProject();

    await page.goto(`/projects/${project.id}`);

    // Heading surfaces the project name.
    await expect(page.getByTestId("overview-heading")).toContainText(project.name);

    // Stat cards carry stable data-testids (kebab-case, keyed by stat).
    for (const stat of ["stat-test-cases", "stat-executions", "stat-knowledge-bases"]) {
      await expect(page.getByTestId(stat)).toBeVisible();
    }
  });

  test("fresh project shows an empty state linking to AI Generation", async ({
    page,
  }: {
    page: Page;
  }) => {
    await injectSession(page);
    const { project } = await bootstrapProject();
    const id = project.id;

    await page.goto(`/projects/${id}`);

    // A brand-new project has 0 test cases / executions / kbs → empty state.
    const empty = page.getByTestId("empty-state");
    await expect(empty).toBeVisible();

    // Guidance steers toward AI generation, with a link to that route.
    await expect(empty).toContainText(/AI|generat/i);
    const link = empty.getByRole("link", { name: /AI|generat/i }).first();
    await expect(link).toHaveAttribute("href", new RegExp(`/projects/${id}/ai-generation`));
  });
});
