import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ModelProvidersService } from "../model-providers/model-providers.service";
import type { ChatMessageDto } from "@crab/shared-types";

export interface ChatCompletionInput {
  providerId?: string;
  projectId: string;
  userMessage: string;
  history: ChatMessageDto[];
  contextBlocks: string[];
  ragBlocks: string[];
  systemPromptOverride?: string;
}

export interface ChatTokenUsageResult {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
}

export interface ChatCompletionResult {
  content: string;
  modelUsed: string;
  providerId: string;
  usage: ChatTokenUsageResult;
}

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);

  constructor(private readonly providers: ModelProvidersService) {}

  async complete(input: ChatCompletionInput): Promise<ChatCompletionResult> {
    const provider = await this.resolveProvider(input.providerId, input.projectId);
    const model = new ChatOpenAI({
      model: provider.modelName,
      configuration: { baseURL: provider.baseUrl },
      apiKey: provider.credential,
      temperature: 0.2,
    });
    this.logger.log(`chat completion via ${provider.modelName}`);
    const messages = [
      new SystemMessage(this.systemPrompt(input.contextBlocks, input.ragBlocks, input.systemPromptOverride)),
      ...input.history.slice(-12).map((message) =>
        message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content),
      ),
      new HumanMessage(input.userMessage),
    ];
    const result = await model.invoke(messages);
    const usage = this.extractUsage(result);
    return {
      content: String(result.content),
      modelUsed: provider.modelName,
      providerId: provider.id,
      usage,
    };
  }

  private extractUsage(result: {
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      input_token_details?: { cache_read?: number; [key: string]: unknown };
      [key: string]: unknown;
    };
    response_metadata?: { usage?: Record<string, number>; [key: string]: unknown };
  }): ChatTokenUsageResult {
    const meta = result.usage_metadata ?? result.response_metadata?.usage;
    const inputTokens = (meta?.input_tokens as number | undefined) ?? 0;
    const outputTokens = (meta?.output_tokens as number | undefined) ?? 0;
    const totalTokens = (meta?.total_tokens as number | undefined) ?? inputTokens + outputTokens;
    const cacheDetails = meta?.input_token_details as { cache_read?: number } | undefined;
    const cacheReadTokens = cacheDetails?.cache_read ?? 0;
    return { inputTokens, outputTokens, totalTokens, cacheReadTokens };
  }

  private async resolveProvider(providerId: string | undefined, projectId: string) {
    let id = providerId;
    if (!id) {
      const provider = (await this.providers.list(projectId)).find((p) => p.kind === "chat" && p.status === "valid");
      if (!provider) {
        throw new BadRequestException(
          "No validated 'chat' model provider configured. Configure one in project settings before starting chat.",
        );
      }
      id = provider.id;
    }
    const provider = await this.providers.resolveForOrchestration(id, "chat");
    return { id, ...provider };
  }

  private systemPrompt(contextBlocks: string[], ragBlocks: string[], override?: string) {
    const base = override?.trim()
      ? override.trim()
      : [
          "You are a QA product assistant inside a test management workspace.",
          "Answer using only backend-provided project context when it is relevant.",
          "Do not reveal credentials, hidden provider configuration, or internal secrets.",
        ].join(" ");
    return [
      base,
      contextBlocks.length ? `Selected project context:\n${contextBlocks.join("\n\n")}` : "",
      ragBlocks.length ? `Retrieved knowledge sources:\n${ragBlocks.join("\n\n")}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 12000);
  }
}
