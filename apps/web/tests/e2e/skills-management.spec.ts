import { expect, test } from "@playwright/test";
import type { ProjectDto } from "@crab/shared-types";
import { API_BASE, injectSession, loginViaApi, uniqueSlug } from "./_helpers";

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`${res.status} ${path}: ${body.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

test("skills management: install, approve permissions, inspect invocation records, and toggle state", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("skills");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Skills ${slug}`, slug }),
  });

  await page.goto(`/projects/${project.id}/skills`);
  await expect(page.getByRole("heading", { name: "Skills Management" })).toBeVisible();

  const skillName = `skill_${slug.replaceAll("-", "_")}`;
  await page.getByTestId("skills-name").fill(skillName);
  await page.getByTestId("skills-version").fill("1.0.0");
  await page.getByTestId("skills-description").fill("Adds safe case enrichment metadata");
  await page.getByTestId("skills-author").fill("crab-e2e");
  await page.getByTestId("skills-source").fill("local-e2e");
  await page.getByTestId("skills-permissions").fill('{ "entryPoints": ["enrich-cases"], "network": ["none"] }');
  await page.getByTestId("skills-entry-points").fill('{ "enrich-cases": { "adapter": "langgraph" } }');
  await page.getByTestId("skills-payload").fill(`${skillName}@1.0.0`);
  await page.getByTestId("skills-install").click();

  await expect(page.getByTestId("skills-detail")).toContainText(skillName);
  await expect(page.getByTestId("skills-detail")).toContainText("installed");
  await expect(page.getByTestId("skills-requested-permissions")).toContainText("enrich-cases");

  await page.getByTestId("skills-approve-permissions").click();
  await expect(page.getByText("Permissions approved.")).toBeVisible();

  await page.getByRole("button", { name: "Run test invocation" }).click();
  await expect(page.getByText("Test invocation recorded.")).toBeVisible();
  await expect(page.getByTestId("skills-invocations")).toContainText("langgraph");
  await expect(page.getByTestId("skills-invocations")).toContainText("denied");

  await page.getByTestId("skills-disable").click();
  await expect(page.getByTestId("skills-detail")).toContainText("disabled");
  await page.getByTestId("skills-enable").click();
  await expect(page.getByTestId("skills-detail")).toContainText("installed");
  await page.getByTestId("skills-uninstall").click();
  await expect(page.getByTestId("skills-detail")).toContainText("uninstalled");
});
