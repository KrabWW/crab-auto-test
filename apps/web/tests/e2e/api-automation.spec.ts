import { expect, test } from "@playwright/test";
import type { ProjectDto } from "@crab/shared-types";
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

test("api automation: create environment, save case, run report", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("api-auto");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `API Automation ${slug}`, slug }),
  });

  const initialEnvironmentLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/api-automation/environments`),
  );
  const initialCaseLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/api-automation/cases`),
  );
  const initialExecutionLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/api-automation/executions`),
  );
  await page.goto(`/projects/${project.id}/api-automation`);
  await Promise.all([initialEnvironmentLoad, initialCaseLoad, initialExecutionLoad]);
  await expect(page.getByRole("heading", { name: "API Automation", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save environment" })).toBeEnabled();

  await page.getByPlaceholder("Variable key").fill("baseUrl");
  await page.getByPlaceholder("Variable value").fill("http://localhost:3000");
  const environmentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/projects/${project.id}/api-automation/environments`),
  );
  await page.getByRole("button", { name: "Save environment" }).click();
  expect((await environmentResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /Local API/ })).toBeVisible();

  await page.getByPlaceholder("API case name").fill(`Unauthenticated profile ${slug}`);
  await page.getByPlaceholder("Request URL").fill("{{baseUrl}}/api/v1/auth/me");
  await page.getByPlaceholder("Expected value").fill("401");
  const caseResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/projects/${project.id}/api-automation/cases`),
  );
  await page.getByRole("button", { name: "Save API case" }).click();
  expect((await caseResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: new RegExp(`Unauthenticated profile ${slug}`) })).toBeVisible();

  const runResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/projects/${project.id}/api-automation/cases/`) &&
      response.url().includes("/runs"),
  );
  await page.getByRole("button", { name: "Run API case" }).click();
  expect((await runResponse).ok()).toBe(true);
  await expect(page.getByTestId("api-run-report")).toContainText("API run passed");
  await expect(page.getByTestId("api-run-report")).toContainText("HTTP 401");
});
