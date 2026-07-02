/**
 * Typed API client + composables for the thin web client.
 * NO LLM/LangGraph/MCP/Prisma imports (Principle 3, §11 a7).
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
} from "@crab/shared-types";

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.NUXT_PUBLIC_API_BASE ?? "http://localhost:3000/api/v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("crab.token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(body.message ?? res.statusText), {
      status: res.status,
      body,
    });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
  executions: {
    list: (projectId: string) => request<ExecutionDto[]>(`/projects/${projectId}/executions`),
    create: (projectId: string, req: CreateExecutionRequest) =>
      request<ExecutionDto>(`/projects/${projectId}/executions`, { method: "POST", body: JSON.stringify(req) }),
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
    list: () => request<ModelProviderDto[]>("/model-providers"),
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
