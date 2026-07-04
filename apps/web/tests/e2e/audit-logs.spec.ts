import { expect, test } from "@playwright/test";
import { injectSession, loginViaApi, uniqueSlug, API_BASE } from "./_helpers";
import type { ProjectDto } from "@crab/shared-types";

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

test("audit logs: filter by project and inspect detail", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("audit");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Audit ${slug}`, slug }),
  });
  // Trigger one audited action so the audit log has at least one entry.
  await api(`/projects/${project.id}/requirements`, {
    method: "POST",
    token,
    body: JSON.stringify({ title: `Checkout ${slug}`, content: "Buyer can pay with a saved card." }),
  });

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Operation Logs", level: 1 })).toBeVisible();

  await page.getByTestId("audit-filter-project").selectOption(project.id);
  await page.getByTestId("audit-filter-action").fill("requirement.create");
  await expect
    .poll(async () => page.getByTestId(/audit-row-/).count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  const firstRow = page.locator('[data-testid^="audit-row-"]').first();
  await firstRow.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/requirement\.create/)).toBeVisible({ timeout: 5_000 });
  await expect(dialog.getByText(/"status":\s*"draft"/)).toBeVisible({ timeout: 5_000 });
});
