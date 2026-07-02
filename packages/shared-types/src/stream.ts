/**
 * Shared streaming envelope (F2 contract).
 * SSE/WebSocket carry the same envelope; web + desktop consume isomorphically.
 *
 * R8: `seq` is ordering-ONLY. On reconnect, clients refetch the authoritative
 * snapshot (GET current run/execution state). There is NO server-side
 * per-event replay buffer (§11 b′3).
 */
import type { AiRunStatus } from "./ai";
import type { ExecutionStatus, ExecutionArtifactDto } from "./execution";

export type StreamTarget = "ai-run" | "execution";

export interface StreamEnvelope<TPayload = unknown> {
  /** AI run id (when target = "ai-run") */
  runId?: string;
  /** Execution id (when target = "execution") */
  executionId?: string;
  /** Ordering-only sequence. NOT a replay cursor. */
  seq: number;
  type:
    | "stage"
    | "partial"
    | "artifact"
    | "success"
    | "fail"
    | "heartbeat"
    | "log"
    | "status";
  stage?: AiWorkflowStage | ExecutionStage;
  payload: TPayload;
  ts: string; // ISO 8601
}

export type AiWorkflowStage =
  | "context-retrieval"
  | "drafting"
  | "validation"
  | "review"
  | "persistence";

export type ExecutionStage =
  | "queued"
  | "dispatched"
  | "running"
  | "artifact-captured"
  | "done";

/** Authoritative snapshot returned on reconnect (R8 snapshot refetch). */
export interface AiRunSnapshot {
  runId: string;
  status: AiRunStatus;
  currentStage?: AiWorkflowStage;
  partialOutput?: unknown;
  events: StreamEnvelope[];
}

export interface ExecutionSnapshot {
  executionId: string;
  status: ExecutionStatus;
  artifacts: ExecutionArtifactDto[];
  events: StreamEnvelope[];
}
