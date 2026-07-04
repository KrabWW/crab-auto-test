/**
 * RetrievalBackend interface (R9 / knowledge-rag.3).
 *
 * AI workflows depend on this interface, NOT on any concrete vector store.
 * The pgvector adapter is the first implementation (A1); a stub adapter
 * proves swappability without a second stateful service (§11 b′5 — Qdrant is
 * a swappable-later alternative, NOT a first-phase implementation).
 *
 * Swappability contract (I-RETRIEVAL-SWAP): a domain layer that calls only
 * these methods must work unchanged when the adapter is swapped.
 */
export interface RetrievedChunk {
  chunkId: string;
  text: string;
  score: number;
  sourceMetadata?: Record<string, unknown>;
}

export interface RetrievalDiagnostic {
  query: string;
  matchedChunks: Array<{
    chunkId: string;
    score: number;
    documentId: string;
    filename?: string;
    sourceMetadata?: Record<string, unknown>;
  }>;
  selectedSources: string[];
  backend: string;
  model: string;
  usingStubVectors: boolean;
}

export interface RetrievalBackend {
  readonly backendName: string;

  /** Embed text into a vector. */
  embed(text: string): Promise<number[]>;

  /**
   * Embed text into a vector for a specific project, tracking per-project
   * stub-vector state so the UI can warn testers when retrieval is using
   * deterministic-hash fallback instead of real embeddings.
   */
  embedForProject(projectId: string, text: string): Promise<number[]>;

  /** Store an embedding for a chunk, returning the opaque vectorRef. */
  store(chunkId: string, embedding: number[], model: string): Promise<string>;

  /** Semantic query: embed the query text and return top-k chunks with scores. */
  query(
    projectId: string,
    queryText: string,
    topK?: number,
  ): Promise<RetrievedChunk[]>;

  /** Whether the project's last embed call degraded to a stub vector. */
  isUsingStubVectors(projectId: string): boolean;

  /** Diagnostics for a query (knowledge-rag.5). */
  diagnose(
    projectId: string,
    queryText: string,
    topK?: number,
  ): Promise<RetrievalDiagnostic>;
}
