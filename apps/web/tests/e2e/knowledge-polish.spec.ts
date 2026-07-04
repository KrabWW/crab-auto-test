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

test("knowledge polish: manage documents, inspect chunks, and review retrieval diagnostics", async ({ page }) => {
  await injectSession(page);
  const token = await loginViaApi();
  const slug = uniqueSlug("knowledge");
  const project = await api<ProjectDto>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: `Knowledge ${slug}`, slug }),
  });

  await page.goto(`/projects/${project.id}/knowledge`);
  await expect(page.getByRole("heading", { name: "Knowledge Base", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New KB" }).click();
  await page.getByTestId("kb-name").fill(`KB ${slug}`);
  await page.getByTestId("kb-description").fill("Project source attribution evidence");
  await page.getByTestId("kb-create").click();
  await expect(page.getByText("Knowledge base created.")).toBeVisible();

  await page.getByTestId("kb-upload-filename").fill(`rag-${slug}.txt`);
  await page.getByTestId("kb-upload-content").fill(
    [
      "Checkout exports must preserve source attribution and document filenames.",
      "",
      "Report diagnostics should show chunk previews, sections, and page references.",
    ].join("\n"),
  );
  await page.getByTestId("kb-ingest").click();
  await expect(page.getByText("Document ingested and chunked.")).toBeVisible();

  const chunks = page.getByTestId("kb-chunks");
  await expect(chunks).toContainText("Chunk 1");
  await expect(chunks).toContainText("source attribution");
  await expect(chunks).toContainText("paragraph-1");
  await expect(chunks).toContainText(`rag-${slug}.txt`);

  await page.getByTestId("kb-diag-query").fill("source attribution filename diagnostics");
  await page.getByTestId("kb-run-diag").click();
  await expect(page.getByText("Retrieval diagnostics updated.")).toBeVisible();

  const diagnostics = page.getByTestId("kb-diagnostics");
  await expect(diagnostics).toContainText("pgvector");
  await expect(diagnostics).toContainText("source attribution");
  await expect(diagnostics).toContainText(`rag-${slug}.txt`);
  await expect(diagnostics).toContainText("Selected sources");
  await expect(diagnostics).toContainText("score");
});
