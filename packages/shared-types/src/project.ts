/** Project management contracts (platform-foundation.2). */
import type { ProjectRole } from "./auth";

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedAt: string;
  acceptedAt?: string;
}

export interface AddMemberRequest {
  userId: string;
  role: ProjectRole;
}

export type ProjectWorkspaceModuleKey =
  | "requirements"
  | "ai-generation"
  | "test-cases"
  | "test-suites"
  | "executions"
  | "api-automation"
  | "reports";

export interface ProjectWorkspaceModuleSummaryDto {
  key: ProjectWorkspaceModuleKey;
  label: string;
  count: number;
  complete: boolean;
  nextAction: string;
  gap: string;
  to: string;
}

export interface ProjectWorkspaceActivityDto {
  label: string;
  detail: string;
  at?: string;
  to: string;
}

export interface ProjectWorkspaceSummaryDto {
  projectId: string;
  generatedAt: string;
  counts: {
    testCases: number;
    testSuites: number;
    executions: number;
    queuedExecutions: number;
    failedExecutions: number;
    reportArtifacts: number;
    apiCases: number;
    apiExecutions: number;
    requirements: number;
    approvedRequirements: number;
    aiRuns: number;
    aiGeneratedCases: number;
    knowledgeBases: number;
    knowledgeDocuments: number;
    chatSessions: number;
    mcpTools: number;
    approvedMcpTools: number;
    skills: number;
    enabledSkills: number;
  };
  modules: ProjectWorkspaceModuleSummaryDto[];
  recentActivity: ProjectWorkspaceActivityDto[];
}
