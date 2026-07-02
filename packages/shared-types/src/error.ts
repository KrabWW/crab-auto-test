/** Versioned error response convention (§6 API boundary). */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "WORKER_TOKEN_REJECTED"
  | "WORKER_JOB_NOT_OWNED"
  | "PROVIDER_INVALID"
  | "AI_RUN_NOT_APPROVABLE"
  | "CLEAN_ROOM_VIOLATION"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  /** Field-level details for VALIDATION_ERROR. */
  details?: Record<string, string>;
  requestId: string;
}
