/** API automation contracts: project-scoped HTTP cases, environments, runs. */
export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiAssertionSource = "status" | "header" | "body";
export type ApiAssertionOperator = "equals" | "contains" | "exists" | "not-empty";
export type ApiExtractionSource = "header" | "body";
export type ApiExecutionStatus = "passed" | "failed" | "error";

export interface ApiNamedValueDto {
  key: string;
  value?: string;
  secretRefId?: string;
  masked?: boolean;
}

export interface CreateApiNamedValueRequest {
  key: string;
  value: string;
  secret?: boolean;
}

export interface ApiEnvironmentDto {
  id: string;
  projectId: string;
  name: string;
  variables: ApiNamedValueDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiEnvironmentRequest {
  name: string;
  variables?: CreateApiNamedValueRequest[];
}

export type UpdateApiEnvironmentRequest = Partial<CreateApiEnvironmentRequest>;

export interface ApiAssertionDto {
  id?: string;
  order: number;
  source: ApiAssertionSource;
  target?: string;
  operator: ApiAssertionOperator;
  expected?: string;
}

export interface ApiVariableExtractionDto {
  id?: string;
  order: number;
  name: string;
  source: ApiExtractionSource;
  path: string;
}

export interface ApiTestCaseDto {
  id: string;
  projectId: string;
  name: string;
  method: ApiHttpMethod;
  url: string;
  headers: ApiNamedValueDto[];
  body?: string;
  assertions: ApiAssertionDto[];
  extractions: ApiVariableExtractionDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiTestCaseRequest {
  name: string;
  method: ApiHttpMethod;
  url: string;
  headers?: CreateApiNamedValueRequest[];
  body?: string;
  assertions?: ApiAssertionDto[];
  extractions?: ApiVariableExtractionDto[];
}

export type UpdateApiTestCaseRequest = Partial<CreateApiTestCaseRequest>;

export interface ApiAssertionResultDto extends ApiAssertionDto {
  actual?: string;
  passed: boolean;
  message?: string;
}

export interface ApiExecutionDto {
  id: string;
  projectId: string;
  caseId: string;
  environmentId?: string;
  environmentName?: string;
  status: ApiExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  responseStatus?: number;
  assertionResults: ApiAssertionResultDto[];
  extractedVariables: Record<string, string>;
  responseSnapshot?: Record<string, unknown>;
  reportSummary?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface CreateApiRunRequest {
  environmentId?: string;
}
