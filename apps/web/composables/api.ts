/**
 * Typed API client + composables for the thin web client.
 * NO LLM/LangGraph/MCP/Prisma imports (Principle 3, §11 a7).
 *
 * Auth token is read from the Pinia authStore (which mirrors `crab.token`
 * in localStorage). On the server we fall back to an empty header.
 */
import type {
  SessionDto,
  LoginRequest,
  ProjectDto,
  CreateProjectRequest,
  TestCaseDto,
  CreateTestCaseRequest,
  ExecutionDto,
  CreateExecutionRequest,
  AiWorkflowRunDto,
  StartTestGenerationRequest,
  ModelProviderDto,
  CreateModelProviderRequest,
  TestSuiteDto,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  SuiteRunDto,
  CreateSuiteRunRequest,
  ApiEnvironmentDto,
  CreateApiEnvironmentRequest,
  UpdateApiEnvironmentRequest,
  ApiTestCaseDto,
  CreateApiTestCaseRequest,
  UpdateApiTestCaseRequest,
  ApiExecutionDto,
  CreateApiRunRequest,
  RequirementDto,
  RequirementVersionDto,
  CreateRequirementRequest,
  UpdateRequirementRequest,
  ChatSessionDto,
  ChatContextOptionDto,
  CreateChatSessionRequest,
  SendChatMessageRequest,
  McpToolDto,
  CreateMcpToolRequest,
  TestMcpToolRequest,
  McpToolHistoryDto,
  McpToolCallResultDto,
} from "@crab/shared-types";

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.NUXT_PUBLIC_API_BASE ?? "http://localhost:3000/api/v1";

function authHeaders(): Record<string, string> {
  if (!import.meta.client) return {};
  // Read directly from localStorage to avoid Pinia store bootstrapping order
  // issues during module init. The authStore mirrors this same key.
  const token = localStorage.getItem("crab.token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(body.message ?? res.statusText), {
      status: res.status,
      body,
    });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  auth: {
    login: (req: LoginRequest) => request<SessionDto>("/auth/login", { method: "POST", body: JSON.stringify(req) }),
    me: () => request<{ id: string; email: string; displayName: string }>("/auth/me"),
  },
  projects: {
    list: () => request<ProjectDto[]>("/projects"),
    create: (req: CreateProjectRequest) => request<ProjectDto>("/projects", { method: "POST", body: JSON.stringify(req) }),
    get: (id: string) => request<ProjectDto>(`/projects/${id}`),
  },
  testCases: {
    list: (projectId: string) => request<TestCaseDto[]>(`/projects/${projectId}/test-cases`),
    create: (projectId: string, req: CreateTestCaseRequest) =>
      request<TestCaseDto>(`/projects/${projectId}/test-cases`, { method: "POST", body: JSON.stringify(req) }),
  },
  testSuites: {
    list: (projectId: string) => request<TestSuiteDto[]>(`/projects/${projectId}/test-suites`),
    create: (projectId: string, req: CreateTestSuiteRequest) =>
      request<TestSuiteDto>(`/projects/${projectId}/test-suites`, { method: "POST", body: JSON.stringify(req) }),
    update: (projectId: string, suiteId: string, req: UpdateTestSuiteRequest) =>
      request<TestSuiteDto>(`/projects/${projectId}/test-suites/${suiteId}`, { method: "PATCH", body: JSON.stringify(req) }),
    remove: (projectId: string, suiteId: string) =>
      request<void>(`/projects/${projectId}/test-suites/${suiteId}`, { method: "DELETE" }),
    run: (projectId: string, suiteId: string, req: CreateSuiteRunRequest) =>
      request<SuiteRunDto>(`/projects/${projectId}/test-suites/${suiteId}/runs`, { method: "POST", body: JSON.stringify(req) }),
    getRun: (projectId: string, runId: string) => request<SuiteRunDto>(`/projects/${projectId}/suite-runs/${runId}`),
    updateCases: (projectId: string, suiteId: string, cases: Array<{ testCaseId: string; order: number }>) =>
      request<TestSuiteDto>(`/projects/${projectId}/test-suites/${suiteId}/cases`, {
        method: "PATCH",
        body: JSON.stringify({ cases }),
      }),
  },
  executions: {
    list: (projectId: string) => request<ExecutionDto[]>(`/projects/${projectId}/executions`),
    create: (projectId: string, req: CreateExecutionRequest) =>
      request<ExecutionDto>(`/projects/${projectId}/executions`, { method: "POST", body: JSON.stringify(req) }),
  },
  apiAutomation: {
    listEnvironments: (projectId: string) =>
      request<ApiEnvironmentDto[]>(`/projects/${projectId}/api-automation/environments`),
    createEnvironment: (projectId: string, req: CreateApiEnvironmentRequest) =>
      request<ApiEnvironmentDto>(`/projects/${projectId}/api-automation/environments`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    updateEnvironment: (projectId: string, environmentId: string, req: UpdateApiEnvironmentRequest) =>
      request<ApiEnvironmentDto>(`/projects/${projectId}/api-automation/environments/${environmentId}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      }),
    removeEnvironment: (projectId: string, environmentId: string) =>
      request<void>(`/projects/${projectId}/api-automation/environments/${environmentId}`, {
        method: "DELETE",
      }),
    listCases: (projectId: string) =>
      request<ApiTestCaseDto[]>(`/projects/${projectId}/api-automation/cases`),
    createCase: (projectId: string, req: CreateApiTestCaseRequest) =>
      request<ApiTestCaseDto>(`/projects/${projectId}/api-automation/cases`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    updateCase: (projectId: string, caseId: string, req: UpdateApiTestCaseRequest) =>
      request<ApiTestCaseDto>(`/projects/${projectId}/api-automation/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      }),
    removeCase: (projectId: string, caseId: string) =>
      request<void>(`/projects/${projectId}/api-automation/cases/${caseId}`, { method: "DELETE" }),
    runCase: (projectId: string, caseId: string, req: CreateApiRunRequest) =>
      request<ApiExecutionDto>(`/projects/${projectId}/api-automation/cases/${caseId}/runs`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    listExecutions: (projectId: string) =>
      request<ApiExecutionDto[]>(`/projects/${projectId}/api-automation/executions`),
    getExecution: (projectId: string, executionId: string) =>
      request<ApiExecutionDto>(`/projects/${projectId}/api-automation/executions/${executionId}`),
  },
  requirements: {
    list: (projectId: string) => request<RequirementDto[]>(`/projects/${projectId}/requirements`),
    approvedVersions: (projectId: string) =>
      request<RequirementVersionDto[]>(`/projects/${projectId}/requirements/approved-versions`),
    create: (projectId: string, req: CreateRequirementRequest) =>
      request<RequirementDto>(`/projects/${projectId}/requirements`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    update: (projectId: string, requirementId: string, req: UpdateRequirementRequest) =>
      request<RequirementDto>(`/projects/${projectId}/requirements/${requirementId}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      }),
    submitReview: (projectId: string, requirementId: string) =>
      request<RequirementDto>(`/projects/${projectId}/requirements/${requirementId}/submit-review`, {
        method: "POST",
      }),
    approve: (projectId: string, requirementId: string) =>
      request<RequirementDto>(`/projects/${projectId}/requirements/${requirementId}/approve`, {
        method: "POST",
      }),
  },
  chat: {
    listSessions: (projectId: string) => request<ChatSessionDto[]>(`/projects/${projectId}/chat/sessions`),
    createSession: (projectId: string, req: CreateChatSessionRequest) =>
      request<ChatSessionDto>(`/projects/${projectId}/chat/sessions`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    getSession: (projectId: string, sessionId: string) =>
      request<ChatSessionDto>(`/projects/${projectId}/chat/sessions/${sessionId}`),
    sendMessage: (projectId: string, sessionId: string, req: SendChatMessageRequest) =>
      request<ChatSessionDto>(`/projects/${projectId}/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    contextOptions: (projectId: string) =>
      request<ChatContextOptionDto[]>(`/projects/${projectId}/chat/context-options`),
  },
  mcp: {
    listTools: (projectId: string) => request<McpToolDto[]>(`/projects/${projectId}/mcp/tools`),
    createTool: (projectId: string, req: CreateMcpToolRequest) =>
      request<McpToolDto>(`/projects/${projectId}/mcp/tools`, { method: "POST", body: JSON.stringify(req) }),
    reviewTool: (projectId: string, toolId: string) =>
      request<McpToolDto>(`/projects/${projectId}/mcp/tools/${toolId}/review`, { method: "POST" }),
    approveTool: (projectId: string, toolId: string) =>
      request<McpToolDto>(`/projects/${projectId}/mcp/tools/${toolId}/approve`, { method: "POST" }),
    revokeTool: (projectId: string, toolId: string) =>
      request<McpToolDto>(`/projects/${projectId}/mcp/tools/${toolId}/revoke`, { method: "POST" }),
    testTool: (projectId: string, toolId: string, req: TestMcpToolRequest) =>
      request<McpToolCallResultDto>(`/projects/${projectId}/mcp/tools/${toolId}/test-call`, {
        method: "POST",
        body: JSON.stringify(req),
      }),
    history: (projectId: string, toolId: string) =>
      request<McpToolHistoryDto>(`/projects/${projectId}/mcp/tools/${toolId}/history`),
  },
  ai: {
    start: (projectId: string, req: Omit<StartTestGenerationRequest, "projectId">) =>
      request<AiWorkflowRunDto>(`/projects/${projectId}/ai/test-generation`, { method: "POST", body: JSON.stringify(req) }),
    get: (projectId: string, runId: string) =>
      request<AiWorkflowRunDto>(`/projects/${projectId}/ai/runs/${runId}`),
    approve: (projectId: string, runId: string) =>
      request<AiWorkflowRunDto>(`/projects/${projectId}/ai/runs/${runId}/approve`, { method: "POST", body: JSON.stringify({}) }),
    reject: (projectId: string, runId: string) =>
      request<AiWorkflowRunDto>(`/projects/${projectId}/ai/runs/${runId}/reject`, { method: "POST" }),
  },
  modelProviders: {
    list: (projectId?: string) =>
      request<ModelProviderDto[]>(`/model-providers${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
    create: (req: CreateModelProviderRequest) =>
      request<ModelProviderDto>("/model-providers", { method: "POST", body: JSON.stringify(req) }),
    validate: (id: string) => request(`/model-providers/${id}/validate`, { method: "POST" }),
  },
  knowledge: {
    listKbs: (projectId: string) => request<{ id: string; name: string; description?: string }[]>(`/projects/${projectId}/knowledge-bases`),
    createKb: (projectId: string, name: string, description?: string) =>
      request(`/projects/${projectId}/knowledge-bases`, { method: "POST", body: JSON.stringify({ name, description }) }),
    listDocs: (projectId: string, kbId: string) =>
      request<{ id: string; filename: string; status: string }[]>(`/projects/${projectId}/knowledge-bases/${kbId}/documents`),
    ingest: (projectId: string, kbId: string, input: { filename: string; mimeType: string; content: string }) =>
      request(`/projects/${projectId}/knowledge-bases/${kbId}/documents`, { method: "POST", body: JSON.stringify(input) }),
    diagnose: (projectId: string, query: string) =>
      request(`/projects/${projectId}/retrieval/query`, { method: "POST", body: JSON.stringify({ query }) }),
  },
};
