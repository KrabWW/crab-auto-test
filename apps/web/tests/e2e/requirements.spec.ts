import { expect, test } from "@playwright/test";
import type { ProjectDto } from "@crab/shared-types";
import { API_BASE, injectSession, loginViaApi, uniqueSlug } from "./_helpers";

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const callerHeaders = (init?.headers ?? {}) as Record<string, string>;
  const callerContentType = callerHeaders["Content-Type"] ?? callerHeaders["content-type"];
  // Default to JSON only when the caller did not specify a Content-Type
  // (multipart uploads must be allowed to set their own boundary).
  if (!callerContentType && typeof init?.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...callerHeaders } });
  if (res.status === 204) return undefined as T;
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
  await expect(page.getByTestId("requirement-detail")).toContainText("in-review");

  const approveResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/approve"),
  );
  await page.getByRole("button", { name: "Approve" }).click();
  expect((await approveResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("approved");
  await expect(page.getByTestId("requirement-detail")).toContainText("Approval history");

  // Reject flow: edit back to draft, submit review, then reject.
  await page.goto(`/projects/${project.id}/requirements`);
  await page.getByTestId("requirement-edit-content").fill("Buyer can pay with a saved card and a coupon.");
  const updateResponse = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes(`/projects/${project.id}/requirements/`),
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await updateResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("Version 2 / draft");

  const submitReviewAgain = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/submit-review"),
  );
  await page.getByTestId("submit-review").click();
  expect((await submitReviewAgain).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("in-review");

  const rejectResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/reject"),
  );
  await page.getByTestId("reject").click();
  await page.getByTestId("confirm-action").click();
  expect((await rejectResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("rejected");

  // Archive flow: from rejected, archive the requirement via confirmation dialog.
  const archiveResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/archive"),
  );
  await page.getByTestId("archive").click();
  await page.getByTestId("confirm-action").click();
  expect((await archiveResponse).ok()).toBe(true);
  await expect(page.getByTestId("requirement-detail")).toContainText("archived");

  // Delete flow: archived requirements are deletable via destructive confirmation.
  const deleteResponse = page.waitForResponse(
    (response) => response.request().method() === "DELETE" && response.url().includes(`/projects/${project.id}/requirements/`),
  );
  await page.getByTestId("delete").click();
  await page.getByTestId("confirm-action").click();
  expect((await deleteResponse).ok()).toBe(true);
});

test("requirements: source document appears in list and detail shows extracted text", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("reqdoc");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `ReqDoc ${slug}`, slug }),
  });

  // Upload a small requirements document directly via the API. The UI file
  // picker is unreliable in headless Chromium across wrapped-input patterns;
  // this test focuses on the integration: API → DB → UI list → detail view.
  const boundary = "----CrabBoundary" + Math.random().toString(36).slice(2);
  const fileContent = `# Checkout requirement\n\nBuyer can pay with a saved card. (${slug})`;
  const bodyParts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="req-${slug}.md"`,
    `Content-Type: text/markdown`,
    ``,
    fileContent,
    `--${boundary}--`,
    ``,
  ].join("\r\n");
  const doc = await api<{ id: string }>(`/projects/${project.id}/requirements/documents`, {
    method: "POST",
    token,
    body: bodyParts,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  });
  expect(doc.id).toBeTruthy();

  await page.goto(`/projects/${project.id}/requirements`);
  await expect(page.getByRole("heading", { name: "Requirements", level: 2 })).toBeVisible();

  const docRow = page.locator(`[data-testid="requirement-document-row-${doc.id}"]`);
  await expect(docRow).toBeVisible({ timeout: 15_000 });

  // Navigate directly to the document detail page; the docRow click uses
  // NuxtLink which sometimes needs an explicit navigation wait.
  await page.goto(`/projects/${project.id}/requirements/${doc.id}`);
  await expect(page.getByRole("heading", { name: /req-/, level: 2 })).toBeVisible();
  await expect(page.getByText(/Buyer can pay with a saved card/)).toBeVisible({ timeout: 15_000 });
});
