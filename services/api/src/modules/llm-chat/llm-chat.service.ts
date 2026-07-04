import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { ChatLlmService } from "./chat-llm.service";
import type {
  ChatActivityDto,
  ChatContextOptionDto,
  ChatContextRef,
  ChatGeneratedArtifactDto,
  ChatMessageDto,
  ChatRole,
  ChatSessionDto,
  CreateChatSessionRequest,
  SendChatMessageRequest,
} from "@crab/shared-types";

interface SessionRow {
  id: string;
  projectId: string;
  providerId: string;
  title: string;
  systemPrompt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageRow[];
  activities: ActivityRow[];
  artifacts: ArtifactRow[];
}

interface MessageRow {
  id: string;
  sessionId: string;
  projectId: string;
  role: string;
  content: string;
  sequence: number;
  contextRefs: unknown;
  sourceAttribution: unknown;
  createdAt: Date;
}

interface ActivityRow {
  id: string;
  sessionId: string;
  messageId: string | null;
  type: string;
  name: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
}

interface ArtifactRow {
  id: string;
  sessionId: string;
  messageId: string;
  projectId: string;
  kind: string;
  title: string;
  content: string;
  metadata: unknown;
  createdBy: string;
  createdAt: Date;
}

type ChatRetrievalResult = {
  blocks: string[];
  sources: ChatMessageDto["sourceAttribution"];
  status: ChatActivityDto["status"];
  error?: string;
};

@Injectable()
export class LlmChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly knowledge: KnowledgeService,
    private readonly llm: ChatLlmService,
  ) {}

  async listSessions(projectId: string): Promise<ChatSessionDto[]> {
    const rows = await this.prisma.chatSession.findMany({
      where: { projectId },
      include: this.includeDetails,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.toSessionDto(row));
  }

  async getSession(projectId: string, sessionId: string): Promise<ChatSessionDto> {
    return this.toSessionDto(await this.findSession(projectId, sessionId));
  }

  async createSession(projectId: string, actorId: string, req: CreateChatSessionRequest): Promise<ChatSessionDto> {
    const providerId = await this.resolveProviderId(projectId, req.providerId);
    const title = req.title?.trim() || "New chat";
    const systemPrompt = req.systemPrompt?.trim() || null;
    const session = await this.prisma.chatSession.create({
      data: { projectId, providerId, title, systemPrompt, createdBy: actorId },
      include: this.includeDetails,
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "chat.session.create",
      targetType: "chat-session",
      targetId: session.id,
      outcome: "success",
      metadata: { providerId, hasSystemPrompt: systemPrompt !== null },
    });
    return this.toSessionDto(session);
  }

  async contextOptions(projectId: string): Promise<ChatContextOptionDto[]> {
    const [requirements, cases] = await Promise.all([
      this.prisma.requirementVersion.findMany({
        where: { projectId, status: "approved" },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        take: 20,
      }),
      this.prisma.testCase.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return [
      ...requirements.map((version) => ({
        kind: "requirement-version" as const,
        id: version.id,
        label: `${version.title} v${version.version}`,
        preview: version.content.slice(0, 180),
      })),
      ...cases.map((testCase) => ({
        kind: "test-case" as const,
        id: testCase.id,
        label: testCase.title,
        preview: testCase.preconditions?.slice(0, 180),
      })),
    ];
  }

  async sendMessage(
    projectId: string,
    sessionId: string,
    actorId: string,
    req: SendChatMessageRequest,
  ): Promise<ChatSessionDto> {
    const content = req.content.trim();
    if (!content) throw new BadRequestException("Message content is required");
    const session = await this.findSession(projectId, sessionId);
    const providerId = req.providerId ?? session.providerId;
    await this.resolveProviderId(projectId, providerId);
    const contextRefs = req.contextRefs ?? [];
    const contextBlocks = await this.resolveContext(projectId, contextRefs);
    const rag = req.ragEnabled ? await this.retrieve(projectId, content) : this.skippedRetrieval();
    const assistant = await this.completeOrAuditFailure(
      projectId,
      sessionId,
      actorId,
      providerId,
      content,
      session.messages.map((message) => this.toMessageDto(message)),
      contextBlocks,
      rag.blocks,
      Boolean(req.ragEnabled),
      contextRefs.length,
      session.systemPrompt,
    );
    const nextSeq = await this.allocateSequences(sessionId);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        projectId,
        role: "user",
        content,
        sequence: nextSeq,
        contextRefs: contextRefs as never,
        sourceAttribution: [],
        createdBy: actorId,
      },
    });
    await this.recordActivity(sessionId, projectId, userMessage.id, "context", "Selected context", "success", {
      count: contextRefs.length,
      refs: contextRefs,
    });
    await this.recordActivity(sessionId, projectId, userMessage.id, "rag", "Knowledge retrieval", rag.status, {
      enabled: Boolean(req.ragEnabled),
      sources: rag.sources,
      ...(rag.error ? { error: rag.error } : {}),
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        projectId,
        role: "assistant",
        content: assistant.content,
        sequence: nextSeq + 1,
        contextRefs: contextRefs as never,
        sourceAttribution: rag.sources as never,
        createdBy: actorId,
      },
    });
    await this.recordActivity(sessionId, projectId, assistantMessage.id, "model", "Model response", "success", {
      providerId: assistant.providerId,
      model: assistant.modelUsed,
    });
    const artifact = await this.prisma.chatGeneratedArtifact.create({
      data: {
        sessionId,
        messageId: assistantMessage.id,
        projectId,
        kind: "assistant-response",
        title: this.artifactTitle(assistant.content),
        content: assistant.content,
        metadata: { sourceCount: rag.sources.length, contextCount: contextRefs.length },
        createdBy: actorId,
      },
    });
    await this.recordActivity(sessionId, projectId, assistantMessage.id, "artifact", "Generated artifact", "success", {
      artifactId: artifact.id,
      kind: artifact.kind,
    });
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { providerId, title: session.title === "New chat" ? content.slice(0, 80) : session.title },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "chat.message.send",
      targetType: "chat-session",
      targetId: sessionId,
      outcome: "success",
      metadata: { providerId, ragEnabled: Boolean(req.ragEnabled), contextCount: contextRefs.length, artifactId: artifact.id },
    });
    return this.getSession(projectId, sessionId);
  }

  private readonly includeDetails = {
    messages: { orderBy: { sequence: "asc" as const } },
    activities: { orderBy: { createdAt: "asc" as const } },
    artifacts: { orderBy: { createdAt: "asc" as const } },
  };

  private async findSession(projectId: string, sessionId: string): Promise<SessionRow> {
    const row = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, projectId },
      include: this.includeDetails,
    });
    if (!row) throw new NotFoundException("Chat session not found");
    return row;
  }

  private async resolveProviderId(projectId: string, providerId?: string): Promise<string> {
    if (providerId) {
      const provider = await this.prisma.modelProvider.findFirst({
        where: { id: providerId, kind: "chat", status: "valid", OR: [{ scope: "global" }, { scope: "project", projectId }] },
      });
      if (!provider) throw new BadRequestException("Validated chat provider not found for this project");
      return provider.id;
    }
    const provider = await this.prisma.modelProvider.findFirst({
      where: { kind: "chat", status: "valid", OR: [{ scope: "global" }, { scope: "project", projectId }] },
      orderBy: { createdAt: "desc" },
    });
    if (!provider) {
      throw new BadRequestException("No validated chat provider configured");
    }
    return provider.id;
  }

  private async resolveContext(projectId: string, refs: ChatContextRef[]): Promise<string[]> {
    const blocks: string[] = [];
    for (const ref of refs) {
      if (ref.kind === "requirement-version") {
        const version = await this.prisma.requirementVersion.findFirst({ where: { id: ref.id, projectId, status: "approved" } });
        if (!version) throw new BadRequestException("Requirement context not found for this project");
        blocks.push(`Requirement ${version.title} v${version.version}:\n${version.content}`);
      } else if (ref.kind === "test-case") {
        const testCase = await this.prisma.testCase.findFirst({ where: { id: ref.id, projectId }, include: { steps: { orderBy: { order: "asc" } } } });
        if (!testCase) throw new BadRequestException("Test case context not found for this project");
        blocks.push([
          `Test case ${testCase.title}`,
          testCase.preconditions ? `Preconditions: ${testCase.preconditions}` : "",
          ...testCase.steps.map((step) => `${step.order}. ${step.action}${step.expectedResult ? ` -> ${step.expectedResult}` : ""}`),
        ].filter(Boolean).join("\n"));
      }
    }
    return blocks;
  }

  private skippedRetrieval(): ChatRetrievalResult {
    return { blocks: [], sources: [], status: "skipped" };
  }

  private async retrieve(projectId: string, query: string): Promise<ChatRetrievalResult> {
    try {
      const result = await this.knowledge.retrieveForGeneration(projectId, query, 5);
      return {
        blocks: result.chunks.map((chunk) => chunk.text),
        sources: result.sources,
        status: "success",
      };
    } catch {
      return {
        blocks: [],
        sources: [],
        status: "failed",
        error: "retrieval unavailable",
      };
    }
  }

  private async completeOrAuditFailure(
    projectId: string,
    sessionId: string,
    actorId: string,
    providerId: string,
    content: string,
    history: ChatMessageDto[],
    contextBlocks: string[],
    ragBlocks: string[],
    ragEnabled: boolean,
    contextCount: number,
    systemPromptOverride: string | null,
  ) {
    try {
      const result = await this.llm.complete({
        providerId,
        projectId,
        userMessage: content,
        history,
        contextBlocks,
        ragBlocks,
        ...(systemPromptOverride ? { systemPromptOverride } : {}),
      });
      // Persist per-request token usage and roll up session totals.
      await this.prisma.chatTokenUsage.create({
        data: {
          projectId,
          sessionId,
          providerId: result.providerId,
          modelUsed: result.modelUsed,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          createdBy: actorId,
        },
      });
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          totalInputTokens: { increment: result.usage.inputTokens },
          totalOutputTokens: { increment: result.usage.outputTokens },
          totalTokens: { increment: result.usage.totalTokens },
          requestCount: { increment: 1 },
        },
      });
      return result;
    } catch (error) {
      await this.recordActivity(sessionId, projectId, undefined, "model", "Model response", "failed", {
        providerId,
        error: error instanceof Error ? error.name : "unknown",
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "chat.message.send",
        targetType: "chat-session",
        targetId: sessionId,
        outcome: "failure",
        metadata: { providerId, ragEnabled, contextCount, error: error instanceof Error ? error.name : "unknown" },
      });
      throw error;
    }
  }

  private async allocateSequences(sessionId: string): Promise<number> {
    const updated = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { nextMessageSequence: { increment: 2 } },
      select: { nextMessageSequence: true },
    });
    return updated.nextMessageSequence - 2;
  }

  private async recordActivity(
    sessionId: string,
    projectId: string,
    messageId: string | undefined,
    type: ChatActivityDto["type"],
    name: string,
    status: ChatActivityDto["status"],
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.chatActivity.create({
      data: { sessionId, projectId, messageId, type, name, status, metadata: metadata as never },
    });
  }

  private artifactTitle(content: string): string {
    const firstLine = content.split(/\r?\n/).find(Boolean)?.trim() ?? "Assistant response";
    return firstLine.slice(0, 80);
  }

  private toSessionDto(row: SessionRow): ChatSessionDto {
    return {
      id: row.id,
      projectId: row.projectId,
      providerId: row.providerId,
      title: row.title,
      ...(row.systemPrompt ? { systemPrompt: row.systemPrompt } : {}),
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
      totalTokens: row.totalTokens,
      requestCount: row.requestCount,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((message) => this.toMessageDto(message)),
      activities: row.activities.map((activity) => this.toActivityDto(activity)),
      artifacts: row.artifacts.map((artifact) => this.toArtifactDto(artifact)),
    };
  }

  private toMessageDto(row: MessageRow): ChatMessageDto {
    return {
      id: row.id,
      sessionId: row.sessionId,
      projectId: row.projectId,
      role: row.role as ChatRole,
      content: row.content,
      sequence: row.sequence,
      contextRefs: Array.isArray(row.contextRefs) ? (row.contextRefs as ChatContextRef[]) : [],
      sourceAttribution: Array.isArray(row.sourceAttribution)
        ? (row.sourceAttribution as ChatMessageDto["sourceAttribution"])
        : [],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toActivityDto(row: ActivityRow): ChatActivityDto {
    return {
      id: row.id,
      sessionId: row.sessionId,
      messageId: row.messageId ?? undefined,
      type: row.type as ChatActivityDto["type"],
      name: row.name,
      status: row.status as ChatActivityDto["status"],
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toArtifactDto(row: ArtifactRow): ChatGeneratedArtifactDto {
    return {
      id: row.id,
      sessionId: row.sessionId,
      messageId: row.messageId,
      projectId: row.projectId,
      kind: row.kind as ChatGeneratedArtifactDto["kind"],
      title: row.title,
      content: row.content,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
