import { test, expect } from "@playwright/test";

/**
 * Top-level navigation tests.
 *
 * NOTE: The web app currently has NO auth middleware (apps/web/middleware/ is absent),
 * so "protected route redirect to /auth/login" is NOT implemented. T7 snapshots the
 * current behavior — when auth middleware lands, T7 should be replaced with a
 * redirect assertion.
 */
test.describe("navigation", () => {
  test("T6: root path redirects to /projects", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/projects/);
  });

  test("T7 (current behavior): unauthenticated /projects still renders — no middleware yet", async ({
    page,
  }) => {
    // Fresh context: no token in localStorage.
    await page.goto("/projects");

    // Page still renders its chrome (header link exists in default layout).
    await expect(page.getByRole("link", { name: /Projects/i }).first()).toBeVisible();
    // And the page-level heading is present (component mounts despite 401 from API).
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
  });
});
