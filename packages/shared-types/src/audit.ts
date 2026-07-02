/** Audit log contracts (platform-foundation.4). */
export type AuditOutcome = "success" | "failure";

export interface AuditLogDto {
  id: string;
  actorId: string;
  projectId?: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  /** Secrets scrubbed (SEC-XC-7 redaction util) before persistence. */
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditQuery {
  projectId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}
