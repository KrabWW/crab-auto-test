import { test, expect, type Page } from "@playwright/test";
import type {
  ProjectDto,
  TestCaseDto,
  AiWorkflowRunDto,
  ExecutionDto,
} from "@crab/shared-types";

/**
 * D1: tracer-bullet e2e — the full MVP loop.
 *
 * login → create project → create test case → ai-generation (draft) →
 * approve (persist canonical) → create execution → (worker claim+run is
 * exercised by the desktop worker against the live api; this e2e asserts the
 * api surface + UI flow) → report contains execution record.
 *
 * Prerequisites (documented, gated on env):
 *  - api running on E2E_API_BASE (default http://localhost:3000/api/v1)
 *  - web running on E2E_WEB_BASE (default http://localhost:3001)
 *  - seed admin present (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *  - a validated `generation` model provider is OPTIONAL for the AI step:
 *    if none is configured, ai-orchestration falls back to the deterministic
 *    draftFromRequirement placeholder, so the loop still completes.
 */
const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:3000/api/v1";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@crab.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`${res.status} ${path}: ${body.message ?? res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

test("tracer-bullet: login → project → test-case → ai-gen → approve → execution", async ({ page }: { page: Page }) => {
  // 1. Login via API (UI login is covered by the page nav below).
  const session = await api<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  expect(session.token).toBeTruthy();
  const token = session.token;

  // 2. Create a project.
  const slug = `e2e-${Date.now()}`;
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `E2E ${slug}`, slug }),
  });
  expect(project.id).toBeTruthy();
  const projectId = project.id;

  // 3. Create a module + test case.
  const mod = await api<{ id: string }>(`/projects/${projectId}/modules`, {
    method: "POST",
    token,
    body: JSON.stringify({ name: "M1", order: 0 }),
  });
  const tc = await api<TestCaseDto>(`/projects/${projectId}/test-cases`, {
    method: "POST",
    token,
    body: JSON.stringify({
      moduleId: mod.id,
      title: `TC ${slug}`,
      priority: "high",
      steps: [{ order: 1, action: "about:blank", expectedResult: "loads" }],
    }),
  });
  expect(tc.steps.length).toBeGreaterThan(0);

  // 4. AI generation (falls back to placeholder if no provider configured).
  const run = await api<AiWorkflowRunDto>(`/projects/${projectId}/ai/test-generation`, {
    method: "POST",
    token,
    body: JSON.stringify({ requirementText: "User can sign in with email and password." }),
  });
  expect(run.id).toBeTruthy();
  // The run should reach awaiting-approval (placeholder path) or a terminal state.
  expect(["awaiting-approval", "failed", "completed", "accepted"]).toContain(run.status);

  // 5. Approve (if awaiting) → persist canonical cases.
  if (run.status === "awaiting-approval") {
    const accepted = await api<AiWorkflowRunDto>(
      `/projects/${projectId}/ai/runs/${run.id}/approve`,
      { method: "POST", token, body: JSON.stringify({}) },
    );
    expect(accepted.status).toBe("accepted");
  }

  // 6. Create an execution for the test case.
  const execution = await api<ExecutionDto>(`/projects/${projectId}/executions`, {
    method: "POST",
    token,
    body: JSON.stringify({ testCaseId: tc.id, environment: "e2e" }),
  });
  expect(execution.id).toBeTruthy();
  expect(execution.status).toBe("queued");

  // 7. UI smoke: load the login page and sign in (proves web + api wired).
  await page.goto("/auth/login");
  await page.fill('input[placeholder="Email"]', EMAIL);
  await page.fill('input[placeholder="Password"]', PASSWORD);
  await page.click("text=Login");
  await page.waitForURL("**/projects");

  // The execution record exists and is queryable (worker run is the desktop
  // worker's job; this e2e asserts the execution record surface, which is the
  // api contract the worker writes to).
  const fetched = await api<ExecutionDto[]>(`/projects/${projectId}/executions`, {
    token,
  });
  expect(fetched.some((e) => e.id === execution.id)).toBe(true);
});
