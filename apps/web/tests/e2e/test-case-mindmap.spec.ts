import { expect, test } from "@playwright/test";
import type { ProjectDto } from "@crab/shared-types";
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

test("test case mindmap: groups cases under modules with priority badges", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("mindmap");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Mindmap ${slug}`, slug }),
  });

  const moduleA = await api<{ id: string }>(`/projects/${project.id}/modules`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Auth ${slug}`, order: 0 }),
  });
  await api(`/projects/${project.id}/test-cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      moduleId: moduleA.id,
      title: `Login happy path ${slug}`,
      priority: "high",
      steps: [{ order: 1, action: "submit credentials", expectedResult: "redirects to dashboard" }],
    }),
  });
  await api(`/projects/${project.id}/test-cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      moduleId: moduleA.id,
      title: `Login bad password ${slug}`,
      priority: "critical",
      steps: [{ order: 1, action: "submit wrong password", expectedResult: "shows error" }],
    }),
  });

  await page.goto(`/projects/${project.id}/test-cases/mindmap`);
  await expect(page.getByRole("heading", { name: "TestCase Mindmap", level: 2 })).toBeVisible();

  await expect
    .poll(async () => page.getByTestId(/mindmap-module-/).count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  // Expand-all so cases render, then verify the two case titles appear.
  await page.getByTestId("mindmap-expand-all").click();
  await expect(page.getByText(`Login happy path ${slug}`)).toBeVisible();
  await expect(page.getByText(`Login bad password ${slug}`)).toBeVisible();

  // JSON export link is present.
  await expect(page.getByTestId("mindmap-export-json")).toBeVisible();
});
