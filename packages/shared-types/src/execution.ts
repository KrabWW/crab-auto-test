/** Execution record + artifact contracts (test-asset-management.2–3). */
export type ExecutionStatus =
  | "queued"
  | "dispatched"
  | "running"
  | "passed"
  | "failed"
  | "aborted"
  | "timeout";

export type ExecutionArtifactType = "screenshot" | "log" | "trace" | "report";
export type SuiteRunStatus = ExecutionStatus | "partial";

export interface ExecutionDto {
  id: string;
  projectId: string;
  testCaseId: string;
  createdBy: string;
  environment: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  failedStepId?: string;
  reportSummary?: Record<string, unknown>;
  /** R2 worker job lifecycle linkage. */
  workerJobId?: string;
  artifacts: ExecutionArtifactDto[];
}

export interface ExecutionArtifactDto {
  id: string;
  executionId: string;
  type: ExecutionArtifactType;
  storageRef: string;
  filename: string;
  sizeBytes: number;
  checksum: string;
  capturedAt: string;
  metadata?: Record<string, unknown>;
  truncated?: boolean;
}

export interface CreateExecutionRequest {
  testCaseId: string;
  environment: string;
}

export interface SuiteRunDto {
  id: string;
  projectId: string;
  suiteId: string;
  environment: string;
  status: SuiteRunStatus;
  executionIds: string[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  createdBy: string;
  createdAt: string;
  executions: ExecutionDto[];
}

export interface CreateSuiteRunRequest {
  environment: string;
}
