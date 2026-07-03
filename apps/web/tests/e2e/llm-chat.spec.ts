import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { ModelProviderDto, ProjectDto, RequirementDto } from "@crab/shared-types";
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

async function startMockChatServer() {
  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      req.resume();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "mock-chat",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Mock assistant recommends testing saved-card checkout and coupon handling.",
              },
              finish_reason: "stop",
            },
          ],
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

test("llm chat: provider-backed chat uses context, RAG toggle, activities, and artifacts", async ({ page }) => {
  let server: Server | undefined;
  try {
    const mock = await startMockChatServer();
    server = mock.server;
    await injectSession(page);
    const token = await loginViaApi();
    const slug = uniqueSlug("llm-chat");
    const project = await api<ProjectDto>("/projects", {
      method: "POST",
      token,
      body: JSON.stringify({ name: `Chat ${slug}`, slug }),
    });
    const provider = await api<ModelProviderDto>("/model-providers", {
      method: "POST",
      token,
      body: JSON.stringify({
        scope: "project",
        projectId: project.id,
        name: "Mock Chat",
        kind: "chat",
        baseUrl: mock.baseUrl,
        modelName: "mock-chat",
        credential: "local-chat-key-123",
      }),
    });
    await api(`/model-providers/${provider.id}/validate`, { method: "POST", token });
    const requirement = await api<RequirementDto>(`/projects/${project.id}/requirements`, {
      method: "POST",
      token,
      body: JSON.stringify({ title: `Checkout ${slug}`, content: "Buyer can pay with a saved card." }),
    });
    await api(`/projects/${project.id}/requirements/${requirement.id}/submit-review`, { method: "POST", token });
    await api(`/projects/${project.id}/requirements/${requirement.id}/approve`, { method: "POST", token });

    await page.goto(`/projects/${project.id}/chat`);
    await expect(page.getByRole("heading", { name: "AI Chat" })).toBeVisible();
    await expect(page.getByTestId("chat-provider")).toContainText("Mock Chat");
    await page.getByRole("button", { name: new RegExp(`Checkout ${slug}`) }).click();
    await page.getByTestId("chat-rag-toggle").check();
    await page.getByTestId("new-chat").click();
    await page.getByTestId("chat-input").fill("What should I test for checkout?");
    const sendResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/chat/sessions/") && response.url().endsWith("/messages"),
    );
    await page.getByTestId("send-chat").click();
    expect((await sendResponse).ok()).toBe(true);

    await expect(page.getByTestId("chat-messages")).toContainText("Mock assistant recommends");
    await expect(page.getByTestId("chat-activities")).toContainText("Knowledge retrieval");
    await expect(page.getByTestId("chat-activities")).toContainText("Generated artifact");
    await expect(page.getByTestId("chat-artifacts")).toContainText("Mock assistant recommends");
  } finally {
    await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
  }
});
