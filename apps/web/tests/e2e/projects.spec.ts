import { test, expect } from "@playwright/test";
import { EMAIL, PASSWORD, uniqueSlug } from "./_helpers";

/**
 * /projects page UI tests.
 *
 * Auth is established via the real UI login flow (not init-script injection):
 * going through /auth/login → submit → navigate yields a fully client-rendered
 * /projects route, which avoids the SSR/hydration mismatch that an injected
 * localStorage token can cause when combined with `page.goto('/projects')`
 * (the layout's `isAuthenticated()` diverges between SSR and client).
 */
async function loginViaUi(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/auth/login");
  await page.getByPlaceholder("Email").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/projects/);
}

test.describe("projects page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  test("T4: list view renders header, pinned demo, search, and new-project button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^New project$/ })).toBeVisible();
    await expect(page.getByPlaceholder("Search projects by name or slug")).toBeVisible();
    const firstCard = page.getByTestId("project-card").first();
    await expect(firstCard).toContainText("WhartTest Demo Workspace");
  });

  test("T5: create project via UI opens Requirements", async ({ page }) => {
    const slug = uniqueSlug("ui-create");
    const name = `UI Test ${slug}`;

    await page.getByRole("button", { name: /^New project$/ }).click();

    await page.getByPlaceholder(/Project name/).fill(name);
    await page.getByPlaceholder(/Slug/).fill(slug);
    await page.getByPlaceholder(/Description/).fill("created by e2e");

    await page.getByRole("button", { name: /^Create project$/ }).click();

    await expect(page).toHaveURL(/\/projects\/[^/]+\/requirements$/);
    await expect(page.getByRole("heading", { name: "Requirements" })).toBeVisible();
  });
});
