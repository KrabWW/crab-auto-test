/**
 * Model provider contracts (platform-foundation.3 + Architect-R5).
 *
 * Architect-R5: credentials stored as Postgres envelope-encrypted ciphertext
 * (credentialCiphertext + credentialKeyId). `validate` decrypts in-process and
 * NEVER returns the secret. No external secret manager (§11 b′4).
 *
 * IMPORTANT: no DTO in this file ever carries credential material.
 */
export type ModelProviderKind = "chat" | "generation" | "embeddings";
export type ModelProviderScope = "global" | "project";
export type ModelProviderValidationStatus =
  | "unvalidated"
  | "valid"
  | "invalid";

export interface ModelProviderDto {
  id: string;
  scope: ModelProviderScope;
  projectId?: string;
  name: string;
  kind: ModelProviderKind;
  baseUrl: string;
  modelName: string;
  status: ModelProviderValidationStatus;
  lastValidatedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** NEVER present in any response — credential is ciphertext-at-rest only. */
  credentialCiphertext?: never;
  credentialKeyId?: never;
}

export interface CreateModelProviderRequest {
  scope: ModelProviderScope;
  projectId?: string;
  name: string;
  kind: ModelProviderKind;
  baseUrl: string;
  modelName: string;
  /** Plaintext credential accepted ONLY on create/validate, never returned. */
  credential: string;
}

export interface ValidateProviderResponse {
  id: string;
  status: ModelProviderValidationStatus;
  lastValidatedAt: string;
  /** Diagnostic only — never the secret. */
  error?: string;
}
