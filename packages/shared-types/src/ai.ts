/**
 * AI orchestration contracts (backend-ai-orchestration.1,2,4 + ai-test-generation.1–3).
 *
 * R1: run state persisted in Prisma AiWorkflowRun (NOT LangGraph checkpointer).
 *     Resume post-approval = POST /ai/runs/:id/approve reads Prisma run state
 *     and invokes the post-approval subgraph. No interrupt()/checkpointer.
 *
 * R7: MVP LangGraph graph topology has NO MCP/Skill nodes (not a switch —
 *     a structural absence; CI import-scan enforced). MCP = P2, Skills = P2.
 *
 * MUST-2: MVP graph exercises state / native tool calls / retries / streaming /
 *         human approval (all facets of backend-ai-orchestration.1).
 */
export type AiRunStatus =
  | "running"
  | "awaiting-approval"
  | "accepted"
  | "rejected"
  | "failed"
  | "completed";

export type AiRunKind = "test-generation";

export type AiRunInputKind = "requirement-text" | "uploaded-attachment";

/**
 * R4: MVP uploaded-context home. Distinct from P2 KB entities
 * (KnowledgeBase/Document/DocumentChunk). AiRunInput is run-scoped.
 */
export interface AiRunInputDto {
  id: string;
  runId: string;
  kind: AiRunInputKind;
  contentRef: string;
  filename?: string;
  sizeBytes?: number;
  checksum?: string;
  createdAt: string;
}

export interface AiWorkflowRunDto {
  id: string;
  projectId: string;
  kind: AiRunKind;
  status: AiRunStatus;
  providerId?: string;
  createdBy: string;
  startedAt: string;
  finishedAt?: string;
  inputs: AiRunInputDto[];
  /** Draft cases produced before human approval (ai-test-generation.2). */
  draftCases: DraftTestCaseDto[];
}

export interface DraftTestCaseDto {
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  preconditions?: string;
  steps: { order: number; action: string; expectedResult?: string }[];
  expectedResults?: string;
}

/** Start generation (MVP input = requirement text + uploaded context; RAG = P2). */
export interface StartTestGenerationRequest {
  projectId: string;
  moduleId?: string;
  providerId?: string;
  requirementText?: string;
  /** References to already-uploaded AiRunInput attachments. */
  attachmentInputIds?: string[];
}

/** Persist accepted drafts as canonical TestCases (persist-handoff). */
export interface AcceptRunRequest {
  /** Indices of draftCases to persist; empty = all. */
  selectedDraftIndices?: number[];
  /** Optional user edits applied to drafts before persist. */
  editedDrafts?: DraftTestCaseDto[];
}
