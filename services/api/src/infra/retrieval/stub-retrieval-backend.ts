/**
 * Stub RetrievalBackend for I-RETRIEVAL-SWAP (knowledge-rag.3 swappability).
 *
 * This proves the interface contract: a domain layer depending only on the
 * RetrievalBackend interface works unchanged when this adapter replaces the
 * pgvector adapter. It is NOT a production backend (§11 b′5: Qdrant is the
 * swappable-later alternative, used behind the same interface).
 *
 * Used in tests; never bound in production.
 */
import type {
  RetrievalBackend,
  RetrievedChunk,
  RetrievalDiagnostic,
} from "./retrieval-backend.interface";

export class StubRetrievalBackend implements RetrievalBackend {
  readonly backendName = "stub";
  private readonly entries = new Map<string, { text: string; embedding: number[]; projectId: string; sourceMetadata?: Record<string, unknown> }>();

  async embed(text: string): Promise<number[]> {
    const dims = 16;
    const vec = new Array(dims).fill(0);
    for (const t of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      vec[h % dims] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  async store(chunkId: string, _embedding: number[], _model: string): Promise<string> {
    return chunkId;
  }

  async query(projectId: string, queryText: string, topK = 5): Promise<RetrievedChunk[]> {
    const qv = await this.embed(queryText);
    const scored = [...this.entries.entries()]
      .filter(([, v]) => v.projectId === projectId)
      .map(([chunkId, e]) => {
        const dot = e.embedding.reduce((s, v, i) => s + v * (qv[i] ?? 0), 0);
        return { text: e.text, score: dot, chunkId, sourceMetadata: e.sourceMetadata };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }

  async diagnose(projectId: string, queryText: string, topK = 5): Promise<RetrievalDiagnostic> {
    const matched = await this.query(projectId, queryText, topK);
    return {
      query: queryText,
      matchedChunks: matched.map((m) => ({ chunkId: m.chunkId, score: m.score, documentId: "", sourceMetadata: m.sourceMetadata })),
      selectedSources: matched.map((m) => m.chunkId),
      backend: this.backendName,
      model: "stub",
    };
  }

  /** Test helper: seed a chunk into the stub store. */
  seed(chunkId: string, text: string, projectId: string, sourceMetadata?: Record<string, unknown>): void {
    void this.embed(text).then((embedding) => {
      this.entries.set(chunkId, { text, embedding, projectId, sourceMetadata });
    });
  }
}
