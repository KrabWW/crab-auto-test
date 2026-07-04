export type ChatRole = "user" | "assistant";
export type ChatActivityType = "context" | "rag" | "model" | "artifact";
export type ChatActivityStatus = "success" | "failed" | "skipped";
export type ChatContextKind = "requirement-version" | "test-case";
export type ChatArtifactKind = "assistant-response";

export interface ChatContextRef {
  kind: ChatContextKind;
  id: string;
}

export interface ChatContextOptionDto extends ChatContextRef {
  label: string;
  preview?: string;
}

export interface ChatActivityDto {
  id: string;
  sessionId: string;
  messageId?: string;
  type: ChatActivityType;
  name: string;
  status: ChatActivityStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatGeneratedArtifactDto {
  id: string;
  sessionId: string;
  messageId: string;
  projectId: string;
  kind: ChatArtifactKind;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface ChatMessageDto {
  id: string;
  sessionId: string;
  projectId: string;
  role: ChatRole;
  content: string;
  sequence: number;
  contextRefs: ChatContextRef[];
  sourceAttribution: Array<{ chunkId: string; filename?: string; section?: string; page?: number }>;
  createdAt: string;
}

export interface ChatSessionDto {
  id: string;
  projectId: string;
  providerId: string;
  title: string;
  systemPrompt?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageDto[];
  activities: ChatActivityDto[];
  artifacts: ChatGeneratedArtifactDto[];
}

export interface CreateChatSessionRequest {
  title?: string;
  providerId?: string;
  systemPrompt?: string;
}

export interface SendChatMessageRequest {
  content: string;
  providerId?: string;
  ragEnabled?: boolean;
  contextRefs?: ChatContextRef[];
}
