/** Test asset contracts (test-asset-management.1). */
export type TestCasePriority = "low" | "medium" | "high" | "critical";
export type TestCaseStatus = "draft" | "active" | "deprecated" | "archived";
export type TestCaseOrigin = "manual" | "ai-generated";

export interface ModuleDto {
  id: string;
  projectId: string;
  parentId?: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseDto {
  id: string;
  projectId: string;
  moduleId?: string;
  title: string;
  preconditions?: string;
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags: string[];
  notes?: string;
  origin: TestCaseOrigin;
  /** Present when origin = "ai-generated" — links back to the run. */
  aiRunId?: string;
  /** Present when linked to an approved managed requirement version. */
  requirementVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  steps: TestStepDto[];
}

export interface TestStepDto {
  id: string;
  testCaseId: string;
  order: number;
  action: string;
  expectedResult?: string;
  data?: unknown;
}

export interface CreateModuleRequest {
  name: string;
  parentId?: string;
  order?: number;
}

export interface CreateTestCaseRequest {
  moduleId?: string;
  title: string;
  preconditions?: string;
  priority: TestCasePriority;
  tags?: string[];
  notes?: string;
  requirementVersionId?: string;
  steps?: CreateTestStepRequest[];
}

export interface CreateTestStepRequest {
  order: number;
  action: string;
  expectedResult?: string;
  data?: unknown;
}

export interface TestSuiteDto {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cases: TestSuiteCaseDto[];
}

export interface TestSuiteCaseDto {
  testCaseId: string;
  order: number;
  testCase?: Pick<TestCaseDto, "id" | "title" | "priority" | "status">;
}

export interface CreateTestSuiteRequest {
  name: string;
  description?: string;
  cases: Array<{ testCaseId: string; order: number }>;
}

export type UpdateTestSuiteRequest = Partial<Pick<CreateTestSuiteRequest, "name" | "description">>;

export interface UpdateTestSuiteCasesRequest {
  cases: Array<{ testCaseId: string; order: number }>;
}
