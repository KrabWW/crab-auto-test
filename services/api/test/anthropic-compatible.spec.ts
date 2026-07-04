import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmDraftService } from "../src/modules/ai-orchestration/llm-draft.service";
import { ChatLlmService } from "../src/modules/llm-chat/chat-llm.service";

const anthropicProvider = {
  baseUrl: "https://open.bigmodel.cn/api/anthropic",
  modelName: "glm-4.6",
  credential: "fake-secret-key",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Anthropic-compatible providers", () => {
  it("routes AI generation to the BigModel Anthropic Messages endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "tool_use",
              name: "draft_test_cases",
              input: {
                cases: [
                  {
                    title: "Login happy path",
                    priority: "high",
                    steps: [{ order: 1, action: "Sign in", expectedResult: "Dashboard opens" }],
                  },
                ],
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new LlmDraftService({
      resolveForOrchestration: vi.fn().mockResolvedValue(anthropicProvider),
    } as never);

    const result = await service.generateDrafts("provider-1", "User can sign in with email.", "project-1");

    expect(result.modelUsed).toBe("glm-4.6");
    expect(result.cases[0]?.title).toBe("Login happy path");
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as [string, RequestInit];
    expect(url).toBe("https://open.bigmodel.cn/api/anthropic/v1/messages");
    expect(init.headers).toMatchObject({
      "anthropic-version": "2023-06-01",
      "x-api-key": "fake-secret-key",
    });
    const body = JSON.parse(String(init.body)) as {
      model: string;
      tool_choice: { type: string; name: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("glm-4.6");
    expect(body.tool_choice).toEqual({ type: "tool", name: "draft_test_cases" });
    expect(body.messages[0]?.content).toContain("User can sign in");
  });

  it("routes AI chat with RAG context to Anthropic Messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Test saved-card checkout and coupon failure paths." }],
          usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new ChatLlmService({
      resolveForOrchestration: vi.fn().mockResolvedValue(anthropicProvider),
    } as never);

    const result = await service.complete({
      providerId: "provider-1",
      projectId: "project-1",
      userMessage: "What should I test?",
      history: [],
      contextBlocks: ["Requirement: buyer can pay with saved card."],
      ragBlocks: ["checkout.md: coupon handling is required."],
    });

    expect(result.content).toContain("saved-card checkout");
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18, cacheReadTokens: 3 });
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as [string, RequestInit];
    expect(url).toBe("https://open.bigmodel.cn/api/anthropic/v1/messages");
    const body = JSON.parse(String(init.body)) as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.system).toContain("Retrieved knowledge sources");
    expect(body.messages[0]).toEqual({ role: "user", content: "What should I test?" });
  });
});
