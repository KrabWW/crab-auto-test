import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { LlmChatService } from "../src/modules/llm-chat/llm-chat.service";

const now = new Date("2026-01-01T00:00:00.000Z");

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "chat-1",
    projectId: "project-a",
    providerId: "provider-1",
    title: "New chat",
    createdBy: "user-a",
    createdAt: now,
    updatedAt: now,
    messages: [],
    activities: [],
    artifacts: [],
    ...overrides,
  };
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    sessionId: "chat-1",
    projectId: "project-a",
    role: "user",
    content: "How should I test checkout?",
    sequence: 1,
    contextRefs: [],
    sourceAttribution: [],
    createdAt: now,
    ...overrides,
  };
}

function makeService(
  prisma: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
  knowledgeOverrides: Record<string, unknown> = {},
  auditOverrides: Record<string, unknown> = {},
) {
  return new LlmChatService(
    prisma as never,
    { record: vi.fn(), ...auditOverrides } as never,
    {
      retrieveForGeneration: vi.fn().mockResolvedValue({
        chunks: [{ chunkId: "chunk-1", text: "Checkout docs mention saved cards." }],
        sources: [{ chunkId: "chunk-1", filename: "checkout.md", section: "paragraph-1" }],
      }),
      ...knowledgeOverrides,
    } as never,
    { complete: vi.fn().mockResolvedValue({ content: "Test saved-card checkout.", modelUsed: "gpt-test", providerId: "provider-1" }), ...overrides } as never,
  );
}

describe("llm chat sessions", () => {
  it("prevents creating a session without a validated chat provider", async () => {
    const svc = makeService({
      modelProvider: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(svc.createSession("project-a", "user-a", {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects selected context that does not belong to the project", async () => {
    const svc = makeService({
      chatSession: { findFirst: vi.fn().mockResolvedValue(sessionRow()) },
      modelProvider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
      requirementVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      svc.sendMessage("project-a", "chat-1", "user-a", {
        content: "Use this requirement",
        contextRefs: [{ kind: "requirement-version", id: "other-project-version" }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists messages, visible activities, source attribution, artifact, and audit-safe metadata", async () => {
    const userMessage = messageRow({ id: "msg-user", role: "user", sequence: 1 });
    const assistantMessage = messageRow({
      id: "msg-assistant",
      role: "assistant",
      content: "Test saved-card checkout.",
      sequence: 2,
      sourceAttribution: [{ chunkId: "chunk-1", filename: "checkout.md" }],
    });
    const final = sessionRow({
      title: "How should I test checkout?",
      messages: [userMessage, assistantMessage],
      activities: [
        { id: "act-1", sessionId: "chat-1", messageId: "msg-user", type: "rag", name: "Knowledge retrieval", status: "success", metadata: {}, createdAt: now },
      ],
      artifacts: [
        {
          id: "artifact-1",
          sessionId: "chat-1",
          messageId: "msg-assistant",
          projectId: "project-a",
          kind: "assistant-response",
          title: "Test saved-card checkout.",
          content: "Test saved-card checkout.",
          metadata: {},
          createdBy: "user-a",
          createdAt: now,
        },
      ],
    });
    const chatMessageCreate = vi.fn().mockResolvedValueOnce(userMessage).mockResolvedValueOnce(assistantMessage);
    const activityCreate = vi.fn();
    const artifactCreate = vi.fn().mockResolvedValue(final.artifacts[0]);
    const chatSessionUpdate = vi.fn().mockResolvedValueOnce({ nextMessageSequence: 3 }).mockResolvedValueOnce({});
    const svc = makeService({
      chatSession: {
        findFirst: vi.fn().mockResolvedValueOnce(sessionRow()).mockResolvedValueOnce(final),
        update: chatSessionUpdate,
      },
      modelProvider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
      requirementVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ver-1",
          projectId: "project-a",
          version: 1,
          title: "Checkout",
          content: "Buyer can pay with a saved card.",
        }),
      },
      chatMessage: { create: chatMessageCreate, findFirst: vi.fn().mockResolvedValue(null) },
      chatActivity: { create: activityCreate },
      chatGeneratedArtifact: { create: artifactCreate },
    });

    const dto = await svc.sendMessage("project-a", "chat-1", "user-a", {
      content: "How should I test checkout?",
      ragEnabled: true,
      contextRefs: [{ kind: "requirement-version", id: "ver-1" }],
    });

    expect(chatMessageCreate).toHaveBeenCalledTimes(2);
    expect(chatSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nextMessageSequence: { increment: 2 } } }),
    );
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "rag", status: "success" }) }),
    );
    expect(artifactCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "assistant-response", content: "Test saved-card checkout." }) }),
    );
    expect(dto.messages).toHaveLength(2);
    expect(dto.artifacts[0]?.kind).toBe("assistant-response");
  });

  it("continues chat when optional RAG retrieval is unavailable", async () => {
    const userMessage = messageRow({ id: "msg-user", role: "user", sequence: 1 });
    const assistantMessage = messageRow({
      id: "msg-assistant",
      role: "assistant",
      content: "Test saved-card checkout.",
      sequence: 2,
    });
    const activityCreate = vi.fn();
    const svc = makeService(
      {
        chatSession: {
          findFirst: vi.fn().mockResolvedValueOnce(sessionRow()).mockResolvedValueOnce(sessionRow({
            messages: [userMessage, assistantMessage],
            activities: [],
            artifacts: [],
          })),
          update: vi.fn().mockResolvedValueOnce({ nextMessageSequence: 3 }).mockResolvedValueOnce({}),
        },
        modelProvider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
        chatMessage: {
          create: vi.fn().mockResolvedValueOnce(userMessage).mockResolvedValueOnce(assistantMessage),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        chatActivity: { create: activityCreate },
        chatGeneratedArtifact: {
          create: vi.fn().mockResolvedValue({
            id: "artifact-1",
            sessionId: "chat-1",
            messageId: "msg-assistant",
            projectId: "project-a",
            kind: "assistant-response",
            title: "Test saved-card checkout.",
            content: "Test saved-card checkout.",
            metadata: {},
            createdBy: "user-a",
            createdAt: now,
          }),
        },
      },
      {},
      { retrieveForGeneration: vi.fn().mockRejectedValue(new Error("missing vector table")) },
    );

    const dto = await svc.sendMessage("project-a", "chat-1", "user-a", {
      content: "How should I test checkout?",
      ragEnabled: true,
    });

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "rag", status: "failed" }) }),
    );
    expect(dto.messages).toHaveLength(2);
  });

  it("records a failure audit when the model call fails before messages are persisted", async () => {
    const audit = { record: vi.fn() };
    const chatMessageCreate = vi.fn();
    const svc = makeService(
      {
        chatSession: { findFirst: vi.fn().mockResolvedValue(sessionRow()) },
        modelProvider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
        chatMessage: { create: chatMessageCreate },
        chatActivity: { create: vi.fn() },
      },
      { complete: vi.fn().mockRejectedValue(new Error("provider unavailable")) },
      {},
      audit,
    );

    await expect(svc.sendMessage("project-a", "chat-1", "user-a", { content: "Will this fail?" })).rejects.toThrow(
      "provider unavailable",
    );
    expect(chatMessageCreate).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure" }));
  });
});
