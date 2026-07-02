/**
 * Worker job protocol (F3 contract).
 *
 * R2: authenticated long-lived session stream (NOT BullMQ transport — §11 b′2).
 * BullMQ is backend-internal bookkeeping only.
 *
 * R3: per-user worker token bound to userId, short TTL + refresh.
 * Backend rejects any result/artifact whose job owner ≠ token user.
 *
 * R2 redelivery: on reconnect, backend re-delivers `dispatched`-but-unacked
 * and incomplete jobs exactly-once (MUST-5).
 */
export type WorkerJobStatus =
  | "queued"
  | "dispatched"
  | "running"
  | "done"
  | "timeout"
  | "aborted";

/** Worker → backend messages (over the authenticated session stream). */
export type WorkerMessage =
  | { kind: "ack"; jobId: string; ts: string }
  | { kind: "heartbeat"; jobId: string; status: WorkerJobStatus; ts: string }
  | {
      kind: "logs";
      jobId: string;
      /** Redacted (secrets/tokens/PII scrubbed) before upload — SEC-PW-4. */
      logs: WorkerLogEntry[];
      ts: string;
    }
  | {
      kind: "result";
      jobId: string;
      status: "done" | "timeout" | "aborted";
      durationMs: number;
      failedStepId?: string;
      reportSummary?: unknown;
      ts: string;
    }
  | { kind: "artifacts"; jobId: string; artifacts: WorkerArtifactMeta[]; ts: string };

/** Backend → worker messages (over the authenticated session stream). */
export type BackendToWorkerMessage =
  | { kind: "dispatch"; job: WorkerJob }
  | { kind: "cancel"; jobId: string; ts: string };

export interface WorkerJob {
  jobId: string;
  executionId: string;
  projectId: string;
  testCaseId: string;
  environment: string;
  /** Per-job hard timeout (automation-workers.2). */
  timeoutMs: number;
  /** Network egress allow/deny policy (automation-workers.2). */
  networkPolicy: WorkerNetworkPolicy;
  /** Resource caps (automation-workers.2). */
  resourceLimits: WorkerResourceLimits;
  steps: WorkerStepSpec[];
  ts: string;
}

export interface WorkerStepSpec {
  stepId: string;
  order: number;
  action: string;
  expectedResult?: string;
  data?: unknown;
}

export interface WorkerNetworkPolicy {
  mode: "allow-list" | "deny-list";
  hosts: string[];
}

export interface WorkerResourceLimits {
  memoryMb: number;
  cpuPercent: number;
  /** Single browser context per job (no parallel contexts). */
  concurrency: 1;
  artifactMaxBytes: number;
}

export interface WorkerLogEntry {
  level: "info" | "warn" | "error";
  /** Redacted text. */
  message: string;
  ts: string;
}

export interface WorkerArtifactMeta {
  type: "screenshot" | "log" | "trace" | "report";
  filename: string;
  sizeBytes: number;
  checksum: string;
  /** Storage reference the backend resolves; worker uploads via /worker/jobs/:id/artifacts. */
  storageRef?: string;
  capturedAt: string;
  metadata?: Record<string, unknown>;
  /** True when redaction/truncation was applied (artifact size limits — SEC-PW-6). */
  truncated?: boolean;
}

/** Worker liveness/status reported to main process (C1/C4). */
export interface WorkerStatus {
  state: "idle" | "running" | "stopped" | "error";
  activeJobId?: string;
  lastHeartbeatAt?: string;
}
