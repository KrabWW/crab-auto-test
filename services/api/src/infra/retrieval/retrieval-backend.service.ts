import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ModelProvidersService } from "../../modules/model-providers/model-providers.service";
import type {
  RetrievalBackend,
  RetrievedChunk,
  RetrievalDiagnostic,
} from "./retrieval-backend.interface";

/**
 * pgvector adapter (R9 / knowledge-rag.3) — the first RetrievalBackend impl.
 *
 * R9 friction (flagged in PLAN-UNIFIED §5): Prisma has no native `vector` type,
 * so ANN queries go through `$queryRaw` against the raw `embedding_vector` table
 * created in the Phase 2 migration. The hnsw index (with ivfflat fallback) is
 * created there too. EmbeddingRef.vectorRef holds the opaque row id for
 * cross-reference; swappability to a stub/Qdrant backend is via the interface.
 *
 * Embeddings use a configured `embeddings` model provider (resolved in-process,
 * Architect-R5). If no provider is configured, embeddings degrade to a
 * deterministic hash-based stub vector so the pipeline is exercisable in dev
 * without a real embedding model.
 */
@Injectable()
export class RetrievalBackendService implements RetrievalBackend {
  readonly backendName = "pgvector";
  private readonly logger = new Logger(RetrievalBackendService.name);
  private dims = 1536;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ModelProvidersService,
  ) {}

  async embed(text: string): Promise<number[]> {
    const provider = await this.tryEmbeddingsProvider();
    if (provider) {
      // Real embedding via the OpenAI-compatible provider.
      const res = await fetch(`${provider.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.credential}`,
        },
        body: JSON.stringify({ model: provider.modelName, input: text.slice(0, 8000) }),
      });
      if (!res.ok) {
        this.logger.warn(`embeddings provider ${provider.baseUrl} returned ${res.status}; using stub vector`);
        return this.stubVector(text);
      }
      const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const vec = json.data?.[0]?.embedding;
      if (vec && vec.length > 0) {
        this.dims = vec.length;
        return vec;
      }
    }
    return this.stubVector(text);
  }

  async store(chunkId: string, embedding: number[], _model: string): Promise<string> {
    const id = chunkId; // vectorRef = chunkId (1:1 with embedding_vector row)
    const vecLit = `[${embedding.join(",")}]`;
    await this.prisma.$executeRaw`
      INSERT INTO "embedding_vector" ("id", "chunk_id", "embedding")
      VALUES (${id}, ${chunkId}, ${vecLit}::vector)
      ON CONFLICT ("chunk_id") DO UPDATE SET "embedding" = EXCLUDED."embedding"
    `;
    return id;
  }

  async query(
    projectId: string,
    queryText: string,
    topK = 5,
  ): Promise<RetrievedChunk[]> {
    const qv = await this.embed(queryText);
    const qLit = `[${qv.join(",")}]`;
    // R9: raw SQL ANN (cosine distance) over the raw embedding_vector table,
    // joined back to DocumentChunk + Document + KnowledgeBase for project scoping.
    const rows = await this.prisma.$queryRaw<
      Array<{ chunk_id: string; text: string; score: number; source_metadata: unknown; filename: string | null }>
    >`
      SELECT ev.chunk_id AS "chunk_id",
             dc.text AS "text",
             1 - (ev.embedding <=> ${qLit}::vector) AS "score",
             dc."sourceMetadata" AS "source_metadata",
             d.filename AS "filename"
      FROM "embedding_vector" ev
      JOIN "DocumentChunk" dc ON dc.id = ev.chunk_id
      JOIN "Document" d ON d.id = dc."documentId"
      JOIN "KnowledgeBase" kb ON kb.id = d."knowledgeBaseId"
      WHERE kb."projectId" = ${projectId}
      ORDER BY ev.embedding <=> ${qLit}::vector
      LIMIT ${topK}
    `;
    return rows.map((r) => ({
      chunkId: r.chunk_id,
      text: r.text,
      score: Number(r.score),
      sourceMetadata: r.source_metadata as Record<string, unknown> | undefined,
    }));
  }

  async diagnose(
    projectId: string,
    queryText: string,
    topK = 5,
  ): Promise<RetrievalDiagnostic> {
    const matched = await this.query(projectId, queryText, topK);
    return {
      query: queryText,
      matchedChunks: matched.map((m) => ({
        chunkId: m.chunkId,
        score: m.score,
        documentId: "", // documentId not selected above; enriched by KnowledgeModule
        sourceMetadata: m.sourceMetadata,
      })),
      selectedSources: matched.map((m) => m.chunkId),
      backend: this.backendName,
      model: "openai-embeddings-or-stub",
    };
  }

  private async tryEmbeddingsProvider(): Promise<{ baseUrl: string; modelName: string; credential: string } | null> {
    try {
      const list = await this.providers.list();
      const emb = list.find((p) => p.kind === "embeddings" && p.status === "valid");
      if (!emb) return null;
      return await this.providers.resolveForOrchestration(emb.id, "embeddings");
    } catch {
      return null;
    }
  }

  /** Deterministic stub vector for dev/CI without a real embeddings provider. */
  private stubVector(text: string): number[] {
    const vec = new Array(this.dims).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const t of tokens) {
      let h = 0;
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      vec[h % this.dims] += 1;
    }
    // L2 normalize.
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
