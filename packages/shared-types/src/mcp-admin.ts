/** MCP admin contracts: project-scoped tool governance and call traces. */
export type McpToolStatus = "proposed" | "reviewed" | "approved" | "revoked";
export type McpToolCallStatus = "success" | "failure" | "rejected";

export interface McpToolDto {
  id: string;
  projectId: string;
  toolName: string;
  serverRef: string;
  description?: string;
  status: McpToolStatus;
  allowlisted: boolean;
  proposedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpToolActionDto {
  id: string;
  toolId: string;
  projectId: string;
  action: string;
  fromStatus?: McpToolStatus;
  toStatus: McpToolStatus;
  actorId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface McpToolCallDto {
  id: string;
  projectId?: string;
  runId?: string;
  toolName: string;
  serverRef: string;
  approved: boolean;
  argsRedacted?: Record<string, unknown>;
  resultMeta?: Record<string, unknown>;
  status: McpToolCallStatus;
  startedAt: string;
  finishedAt?: string;
}

export interface CreateMcpToolRequest {
  toolName: string;
  serverRef: string;
  description?: string;
}

export interface TestMcpToolRequest {
  args?: Record<string, unknown>;
  runId?: string;
}

export interface McpToolCallResultDto {
  approved: boolean;
  status: McpToolCallStatus;
  resultMeta: Record<string, unknown>;
}

export interface McpToolHistoryDto {
  tool: McpToolDto;
  actions: McpToolActionDto[];
  calls: McpToolCallDto[];
}
