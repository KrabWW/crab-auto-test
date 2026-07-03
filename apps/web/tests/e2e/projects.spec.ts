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

  test("T4: list view renders header and new-project button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^New project$/ })).toBeVisible();
  });

  test("T5: create project via UI shows new entry in list", async ({ page }) => {
    const slug = uniqueSlug("ui-create");
    const name = `UI Test ${slug}`;

    await page.getByRole("button", { name: /^New project$/ }).click();

    await page.getByPlaceholder("Name").fill(name);
    await page.getByPlaceholder("Slug").fill(slug);
    await page.getByPlaceholder("Description").fill("created by e2e");

    await page.getByRole("button", { name: /^Create$/ }).click();

    // After create, projects/index.vue reloads the list; assert slug appears.
    await expect(page.getByText(slug, { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
