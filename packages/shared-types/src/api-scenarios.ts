/** API scenario (multi-step ordered workflow) contracts. */

export interface ApiScenarioStepDto {
  id: string;
  scenarioId: string;
  caseId: string;
  order: number;
  case?: Pick<
    import("./api-automation").ApiTestCaseDto,
    "id" | "name" | "method" | "url"
  >;
}

export interface ApiScenarioDto {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  steps: ApiScenarioStepDto[];
}

export interface CreateApiScenarioRequest {
  name: string;
  description?: string;
  steps: Array<{ caseId: string; order: number }>;
}

export type UpdateApiScenarioRequest = Partial<
  Pick<CreateApiScenarioRequest, "name" | "description">
>;

export interface UpdateApiScenarioStepsRequest {
  steps: Array<{ caseId: string; order: number }>;
}

export type ApiScenarioRunStatus =
  | "running"
  | "passed"
  | "failed"
  | "aborted"
  | "partial";

export interface ApiScenarioRunSummary {
  totalSteps: number;
  executedSteps: number;
  passed: number;
  failed: number;
  errored: number;
}

export interface ApiScenarioRunDto {
  id: string;
  projectId: string;
  scenarioId: string;
  environmentId?: string;
  environmentName?: string;
  status: ApiScenarioRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  summary?: ApiScenarioRunSummary;
  createdBy: string;
  createdAt: string;
  executions: Array<
    Pick<
      import("./api-automation").ApiExecutionDto,
      | "id"
      | "caseId"
      | "status"
      | "startedAt"
      | "finishedAt"
      | "durationMs"
      | "responseStatus"
      | "assertionResults"
      | "extractedVariables"
    > & { scenarioStepIndex?: number }
  >;
}

export interface CreateApiScenarioRunRequest {
  environmentId?: string;
}
