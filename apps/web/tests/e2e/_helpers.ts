/**
 * Shared e2e helpers — auth state injection + constants.
 *
 * Mirrors useSession.ts storage key (`crab.token`) so the app picks up the
 * injected token on first page load.
 */
import type { Page } from "@playwright/test";

export const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:3000/api/v1";
export const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@crab.local";
export const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

/** POST /auth/login via Node fetch and return the session token. */
export async function loginViaApi(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`loginViaApi ${res.status}: ${body.message ?? res.statusText}`);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Log in via API, then seed localStorage so the next page.goto is authenticated. */
export async function injectSession(page: Page): Promise<void> {
  const token = await loginViaApi();
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("crab.token", t);
    } catch {
      /* ignore — SSR / non-browser env */
    }
  }, token);
}

/** Generate a unique slug for resource creation (avoids collisions across runs). */
export function uniqueSlug(prefix = "ui"): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now()}-${rand}`;
}
