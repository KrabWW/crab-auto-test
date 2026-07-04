export interface LlmProviderConfig {
  baseUrl: string;
  modelName: string;
  credential: string;
}

export interface LlmTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
}

export function isAnthropicCompatibleBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    return url.hostname === "api.anthropic.com" || path.endsWith("/anthropic");
  } catch {
    return baseUrl.replace(/\/+$/, "").endsWith("/anthropic");
  }
}

export async function invokeAnthropicText(
  provider: LlmProviderConfig,
  input: {
    system?: string;
    messages: AnthropicMessage[];
    temperature: number;
    maxTokens: number;
  },
): Promise<{ content: string; usage: LlmTokenUsage }> {
  const response = await postAnthropic(provider, {
    system: input.system,
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
  });
  return { content: extractText(response), usage: toUsage(response.usage) };
}

export async function invokeAnthropicTool<T>(
  provider: LlmProviderConfig,
  input: {
    prompt: string;
    toolName: string;
    inputSchema: Record<string, unknown>;
    temperature: number;
    maxTokens: number;
    parse: (value: unknown) => T;
  },
): Promise<T> {
  const response = await postAnthropic(provider, {
    messages: [{ role: "user", content: input.prompt }],
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    tools: [
      {
        name: input.toolName,
        description: "Return the requested structured JSON object.",
        input_schema: input.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: input.toolName },
  });

  const toolUse = response.content?.find((block) => block.type === "tool_use" && block.name === input.toolName);
  if (toolUse?.input !== undefined) {
    return input.parse(toolUse.input);
  }
  return input.parse(parseJsonObject(extractText(response)));
}

function messagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/messages")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

async function postAnthropic(provider: LlmProviderConfig, payload: Record<string, unknown>): Promise<AnthropicResponse> {
  const res = await fetch(messagesUrl(provider.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": provider.credential,
    },
    body: JSON.stringify({
      model: provider.modelName,
      ...payload,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic-compatible provider returned ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as AnthropicResponse;
}

function extractText(response: AnthropicResponse): string {
  const text = response.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic-compatible provider returned no text content");
  return text;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/u, "").trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Anthropic-compatible provider response did not contain a JSON object");
  }
}

function toUsage(usage: AnthropicUsage | undefined): LlmTokenUsage {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
  };
}
