/** Project API key contracts. */

export interface ProjectApiKeyDto {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateProjectApiKeyRequest {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface ProjectApiKeyCreatedDto extends ProjectApiKeyDto {
  /** Full plaintext key — only returned once at creation. */
  plaintextKey: string;
}
