/** MCP server registry contracts (project-scoped remote server configs). */

export interface McpServerConfigDto {
  id: string;
  projectId: string;
  name: string;
  url: string;
  transport: string;
  headers?: Record<string, string>;
  isActive: boolean;
  lastSyncAt?: string;
  syncError?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpServerRequest {
  name: string;
  url: string;
  transport?: string;
  headers?: Record<string, string>;
}

export interface UpdateMcpServerRequest {
  name?: string;
  url?: string;
  transport?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
}

export interface McpServerSyncResult {
  server: McpServerConfigDto;
  syncedTools: Array<{
    toolName: string;
    description?: string;
    created: boolean;
  }>;
}
