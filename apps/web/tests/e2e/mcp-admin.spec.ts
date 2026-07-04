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

test("mcp admin: register, test-call, approve, revoke, and inspect history", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("mcp-admin");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `MCP ${slug}`, slug }),
  });

  await page.goto(`/projects/${project.id}/mcp-admin`);
  await expect(page.getByRole("heading", { name: "MCP Admin" })).toBeVisible();
  const toolName = `search_${slug.replaceAll("-", "_")}`;
  const serverRef = `http://127.0.0.1:1/${slug}/mcp`;
  await page.getByPlaceholder("Tool name, e.g. search_docs").fill(toolName);
  await page.getByPlaceholder("MCP HTTP endpoint, e.g. http://localhost:9000/mcp").fill(serverRef);
  await expect(page.getByPlaceholder("Tool name, e.g. search_docs")).toHaveValue(toolName);
  await expect(page.getByPlaceholder("MCP HTTP endpoint, e.g. http://localhost:9000/mcp")).toHaveValue(serverRef);
  await page.getByTestId("mcp-create-tool").click();
  await expect(page.getByTestId("mcp-tool-detail")).toContainText("proposed");

  await page.getByTestId("mcp-test-call").click();
  await expect(page.getByTestId("mcp-call-status")).toContainText("rejected");
  await expect(page.getByTestId("mcp-history")).toContainText("Tool-call log");

  await page.getByTestId("mcp-review-tool").click();
  await expect(page.getByTestId("mcp-tool-detail")).toContainText("reviewed");
  await page.getByTestId("mcp-approve-tool").click();
  await expect(page.getByTestId("mcp-tool-detail")).toContainText("approved");
  await expect(page.getByText("Allowlisted", { exact: true })).toBeVisible();
  await page.getByTestId("mcp-revoke-tool").click();
  await expect(page.getByTestId("mcp-tool-detail")).toContainText("revoked");
  await expect(page.getByTestId("mcp-history")).toContainText("revoke");
});
