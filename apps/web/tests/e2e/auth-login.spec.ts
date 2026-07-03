import { test, expect } from "@playwright/test";
import { EMAIL, PASSWORD } from "./_helpers";

/**
 * Login page (/auth/login) UI tests.
 *
 * Covers: success → /projects, wrong password → error, empty submit → stays on page.
 * Selectors target Arco Design Vue components:
 *   - <a-input placeholder="Email"> renders <input> with placeholder
 *   - <a-input-password placeholder="Password"> renders <input type="password"> with placeholder
 *   - <a-button html-type="submit"> renders <button>
 *   - <a-alert type="error"> renders element with role="alert"
 */
test.describe("auth login page", () => {
  test("T1: successful login navigates to /projects", async ({ page }) => {
    await page.goto("/auth/login");

    await page.getByPlaceholder("Email").fill(EMAIL);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /^Login$/ }).click();

    await expect(page).toHaveURL(/\/projects$/);
  });

  test("T2: wrong password shows error message", async ({ page }) => {
    await page.goto("/auth/login");

    await page.getByPlaceholder("Email").fill(EMAIL);
    await page.getByPlaceholder("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: /^Login$/ }).click();

    // Arco <a-alert type="error"> renders with role="alert"
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    // URL must remain on login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("T3: empty submit keeps user on login page", async ({ page }) => {
    await page.goto("/auth/login");

    await page.getByRole("button", { name: /^Login$/ }).click();

    // Arco form validation prevents submit; URL stays on login.
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
