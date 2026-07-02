/**
 * Auth contracts (platform-foundation.1, .2 + R3 worker token).
 * Simple roles ONLY — owner/member (§11 a2, no complex RBAC).
 */
export type ProjectRole = "owner" | "member";

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface SessionDto {
  user: UserDto;
  /** Short-lived session token; refresh handled by client. */
  token: string;
  expiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * R3: per-user worker token. Minted by backend at desktop login,
 * bound to userId, short TTL + refresh. Backend rejects worker
 * results for jobs not assigned to that user's worker.
 */
export interface WorkerTokenDto {
  token: string;
  userId: string;
  expiresAt: string;
  refreshToken: string;
}

export interface WorkerTokenRefreshRequest {
  refreshToken: string;
}
