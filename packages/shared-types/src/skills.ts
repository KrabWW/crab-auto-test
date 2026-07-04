/** Skills management contracts: project-scoped installations and invocation traces. */
export type SkillValidationStatus = "unvalidated" | "valid" | "invalid";
export type SkillInstallationState = "installed" | "disabled" | "uninstalled";
export type SkillInvocationStatus = "success" | "failure" | "denied";

export interface SkillPackageManifestDto {
  name: string;
  version: string;
  description: string;
  author: string;
  compatibility: Record<string, unknown>;
  permissions: Record<string, unknown>;
  entryPoints: Record<string, unknown>;
  checksum: string;
  source: string;
  payload?: string;
}

export interface SkillDto {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  compatibility: Record<string, unknown>;
  permissions: Record<string, unknown>;
  entryPoints: Record<string, unknown>;
  checksum: string;
  source: string;
  validationStatus: SkillValidationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SkillInvocationDto {
  id: string;
  installationId: string;
  runId?: string;
  workerJobRef?: string;
  adapter: string;
  permissionsUsed?: Record<string, unknown>;
  argsRedacted?: Record<string, unknown>;
  resultMeta?: Record<string, unknown>;
  status: SkillInvocationStatus;
  invokedAt: string;
}

export interface SkillInstallationDto {
  id: string;
  projectId?: string;
  state: SkillInstallationState;
  activatedPermissions?: Record<string, unknown>;
  previousVersionId?: string;
  installedBy: string;
  installedChecksum: string;
  createdAt: string;
  updatedAt: string;
  skill: SkillDto;
  invocationCount: number;
  recentInvocations: SkillInvocationDto[];
}

export interface ApproveSkillPermissionsRequest {
  permissions: Record<string, unknown>;
}

export interface InvokeSkillTestRequest {
  entryPoint?: string;
  adapter?: "langgraph" | "mcp" | "worker";
  args?: Record<string, unknown>;
}
