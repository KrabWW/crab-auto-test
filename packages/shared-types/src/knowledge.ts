/** Knowledge/RAG contracts: project-scoped documents, chunks, retrieval diagnostics, and source attribution. */
export interface KnowledgeBaseDto {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
}

export type KnowledgeDocumentStatus = "ingested" | "failed";

export interface KnowledgeDocumentDto {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: KnowledgeDocumentStatus;
  sourceMetadata?: Record<string, unknown>;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IngestKnowledgeDocumentRequest {
  filename: string;
  mimeType: string;
  content: string;
}

export interface KnowledgeChunkDto {
  id: string;
  documentId: string;
  order: number;
  textPreview: string;
  tokenCount: number;
  sourceMetadata?: Record<string, unknown>;
  hasEmbedding: boolean;
  createdAt: string;
}

export interface KnowledgeSourceAttributionDto {
  chunkId: string;
  documentId?: string;
  filename?: string;
  section?: string;
  page?: number;
  score?: number;
}

export interface RetrievedKnowledgeChunkDto {
  chunkId: string;
  text: string;
  score: number;
  sourceMetadata?: Record<string, unknown>;
}

export interface RetrieveKnowledgeResultDto {
  chunks: RetrievedKnowledgeChunkDto[];
  sources: KnowledgeSourceAttributionDto[];
}

export interface KnowledgeRetrievalDiagnosticDto {
  query: string;
  matchedChunks: Array<{
    chunkId: string;
    score: number;
    documentId: string;
    filename?: string;
    textPreview?: string;
    sourceMetadata?: Record<string, unknown>;
  }>;
  selectedSources: KnowledgeSourceAttributionDto[];
  backend: string;
  model: string;
}

// ─── Retrieval query log (observability for testers) ───────────────────────

export type RetrievalQuerySource = "generation" | "diagnostic" | "chat-rag";

export interface RetrievalQueryLogDto {
  id: string;
  projectId: string;
  query: string;
  source: RetrievalQuerySource;
  topK: number;
  retrievalTimeMs?: number;
  retrievedChunks?: Array<{
    chunkId: string;
    score?: number;
    filename?: string;
    section?: string;
  }>;
  success: boolean;
  error?: string;
  createdBy?: string;
  createdAt: string;
}
