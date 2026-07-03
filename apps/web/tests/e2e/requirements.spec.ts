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
  return (await res.json()) as T;
}

test("requirements: create, review, approve, and revise", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("req-mgmt");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Requirement ${slug}`, slug }),
  });

  const initialLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/requirements`),
  );
  await page.goto(`/projects/${project.id}/requirements`);
  await initialLoad;
  await expect(page.getByRole("heading", { name: "Requirements", level: 2 })).toBeVisible();

  const titleInput = page.getByTestId("requirement-title-input");
  const contentInput = page.getByTestId("requirement-content-input");
  const createButton = page.getByTestId("create-requirement");
  await expect(titleInput).toBeVisible();
  await expect(async () => {
    await titleInput.fill(`Checkout ${slug}`);
    await contentInput.fill("Buyer can pay with a saved card.");
    await expect(titleInput).toHaveValue(`Checkout ${slug}`);
    await expect(contentInput).toHaveValue("Buyer can pay with a saved card.");
    await expect(createButton).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/projects/${project.id}/requirements`),
  );
  await createButton.click();
  expect((await createResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("draft");

  const reviewResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/submit-review"),
  );
  await page.getByRole("button", { name: "Submit review" }).click();
  expect((await reviewResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("reviewed");

  const approveResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/approve"),
  );
  await page.getByRole("button", { name: "Approve" }).click();
  expect((await approveResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("approved");
  await expect(page.getByTestId("requirement-detail")).toContainText("Approval records");

  const approvedVersionsLoad = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/projects/${project.id}/requirements/approved-versions`),
  );
  await page.goto(`/projects/${project.id}/ai-generation`);
  await approvedVersionsLoad;
  await expect(page.getByLabel("Approved requirement")).toContainText(`Checkout ${slug}`);
  await page.goto(`/projects/${project.id}/requirements`);

  await page.getByTestId("requirement-edit-content").fill("Buyer can pay with a saved card and a coupon.");
  const updateResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/projects/${project.id}/requirements/`),
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await updateResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("Version 2 / draft");
});
