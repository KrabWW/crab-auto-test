import {
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { RetrievalBackend } from "../../infra/retrieval/retrieval-backend.interface";
import { AuditService } from "../audit/audit.service";
import { createHash } from "node:crypto";
import type { RetrievedChunk } from "../../infra/retrieval/retrieval-backend.interface";
import type {
  KnowledgeBaseDto,
  KnowledgeChunkDto,
  KnowledgeDocumentDto,
  KnowledgeRetrievalDiagnosticDto,
  KnowledgeSourceAttributionDto,
  RetrieveKnowledgeResultDto,
  RetrievalQueryLogDto,
} from "@crab/shared-types";

/**
 * knowledge-rag.1–5: project-scoped KB / Document / Chunk CRUD + ingest +
 * retrieve + source attribution + diagnostics.
 *
 * Project isolation (knowledge-rag.1): every route-level operation verifies the
 * KnowledgeBase belongs to the route project before returning documents/chunks.
 * RetrievalBackend.query is also project-scoped (joins KnowledgeBase.projectId),
 * and service enrichment defensively re-checks chunk ownership.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("RetrievalBackend") private readonly retrieval: RetrievalBackend,
    private readonly audit: AuditService,
  ) {}

  async createKb(projectId: string, actorId: string, name: string, description?: string): Promise<KnowledgeBaseDto> {
    const kb = await this.prisma.knowledgeBase.create({
      data: { projectId, name, description },
      include: { _count: { select: { documents: true } } },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "kb.create",
      targetType: "knowledge-base",
      targetId: kb.id,
      outcome: "success",
    });
    return this.toKnowledgeBaseDto(kb);
  }

  async listKbs(projectId: string): Promise<KnowledgeBaseDto[]> {
    const rows = await this.prisma.knowledgeBase.findMany({
      where: { projectId },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toKnowledgeBaseDto(row));
  }

  /**
   * Ingest a document: extract text, chunk, embed, store. Source metadata
   * (filename/section/page) is retained per chunk.
   */
  async ingestDocument(
    kbId: string,
    projectId: string,
    actorId: string,
    input: { filename: string; mimeType: string; content: string },
  ): Promise<KnowledgeDocumentDto> {
    await this.ensureKnowledgeBase(projectId, kbId);
    const checksum = createHash("sha256").update(input.content).digest("hex");
    const sizeBytes = Buffer.byteLength(input.content, "utf8");

    const doc = await this.prisma.document.create({
      data: {
        knowledgeBaseId: kbId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksum,
        status: "ingested",
        sourceMetadata: { filename: input.filename, mimeType: input.mimeType },
      },
    });

    const chunks = this.chunkText(input.content);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!;
      const chunk = await this.prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          order: i,
          text: c.text,
          tokenCount: c.tokenCount,
          sourceMetadata: { filename: input.filename, section: c.section, page: c.page, order: i },
        },
      });
      const embedding = await this.retrieval.embedForProject(projectId, c.text);
      const vectorRef = await this.retrieval.store(chunk.id, embedding, "openai-embeddings-or-stub");
      await this.prisma.embeddingRef.create({
        data: {
          chunkId: chunk.id,
          backend: this.retrieval.backendName,
          vectorRef,
          dims: embedding.length,
          model: "openai-embeddings-or-stub",
        },
      });
    }

    await this.audit.record({
      actorId,
      projectId,
      action: "kb.document.ingest",
      targetType: "document",
      targetId: doc.id,
      outcome: "success",
      metadata: { filename: input.filename, chunks: chunks.length },
    });
    return this.getDocumentDto(projectId, kbId, doc.id);
  }

  async listDocuments(projectId: string, kbId: string): Promise<KnowledgeDocumentDto[]> {
    await this.ensureKnowledgeBase(projectId, kbId);
    const rows = await this.prisma.document.findMany({
      where: { knowledgeBaseId: kbId },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDocumentDto(row));
  }

  async listDocumentChunks(projectId: string, kbId: string, documentId: string): Promise<KnowledgeChunkDto[]> {
    await this.ensureDocument(projectId, kbId, documentId);
    const rows = await this.prisma.documentChunk.findMany({
      where: { documentId },
      include: { embeddingRef: { select: { id: true } } },
      orderBy: { order: "asc" },
    });
    return rows.map((row) => this.toChunkDto(row));
  }

  /** knowledge-rag.4: retrieve with source attribution for AI generation. */
  async retrieveForGeneration(
    projectId: string,
    queryText: string,
    topK = 5,
  ): Promise<RetrieveKnowledgeResultDto> {
    const started = Date.now();
    try {
      const chunks = await this.retrieval.query(projectId, queryText, topK);
      const ownership = await this.enrichChunkOwnership(projectId, chunks);
      const allowed = new Set(ownership.map((item) => item.chunkId));
      const filtered = chunks.filter((chunk) => allowed.has(chunk.chunkId));
      await this.logRetrieval({
        projectId,
        query: queryText,
        source: "generation",
        topK,
        retrievalTimeMs: Date.now() - started,
        retrieved: filtered.map((c) => {
          const own = ownership.find((o) => o.chunkId === c.chunkId);
          return {
            chunkId: c.chunkId,
            ...(c.score !== undefined ? { score: c.score } : {}),
            ...(own?.source.filename ? { filename: own.source.filename } : {}),
            ...(own?.source.section ? { section: own.source.section } : {}),
          };
        }),
        success: true,
      });
      return {
        chunks: filtered,
        sources: ownership.map((item) => item.source),
      };
    } catch (err) {
      await this.logRetrieval({
        projectId,
        query: queryText,
        source: "generation",
        topK,
        retrievalTimeMs: Date.now() - started,
        success: false,
        error: err instanceof Error ? err.message : "Retrieval failed",
      });
      throw err;
    }
  }

  /** knowledge-rag.5: retrieval diagnostics (query/matched/scores/sources). */
  async diagnose(projectId: string, queryText: string, topK = 5): Promise<KnowledgeRetrievalDiagnosticDto> {
    const started = Date.now();
    try {
      const diag = await this.retrieval.diagnose(projectId, queryText, topK);
      const enriched = (
        await Promise.all(
          diag.matchedChunks.map(async (m) => {
            const chunk = await this.findProjectChunk(projectId, m.chunkId);
            if (!chunk) return null;
            const metadata = asRecord(chunk.sourceMetadata) ?? m.sourceMetadata;
            return {
              ...m,
              documentId: chunk.document.id,
              filename: chunk.document.filename ?? (metadata?.filename as string | undefined),
              textPreview: preview(chunk.text),
              sourceMetadata: metadata,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);
      await this.logRetrieval({
        projectId,
        query: queryText,
        source: "diagnostic",
        topK,
        retrievalTimeMs: Date.now() - started,
        retrieved: enriched.map((m) => ({
          chunkId: m.chunkId,
          ...(m.score !== undefined ? { score: m.score } : {}),
          ...(m.filename ? { filename: m.filename } : {}),
        })),
        success: true,
      });
      return {
        query: diag.query,
        matchedChunks: enriched,
        selectedSources: enriched
          .filter((item) => item.documentId)
          .map((item) => toSourceAttribution(item.chunkId, item.documentId, item.filename, item.sourceMetadata, item.score)),
        backend: diag.backend,
        model: diag.model,
        usingStubVectors: diag.usingStubVectors,
      };
    } catch (err) {
      await this.logRetrieval({
        projectId,
        query: queryText,
        source: "diagnostic",
        topK,
        retrievalTimeMs: Date.now() - started,
        success: false,
        error: err instanceof Error ? err.message : "Diagnostic failed",
      });
      throw err;
    }
  }

  /** List recent retrieval query logs for observability. */
  async listQueryLogs(
    projectId: string,
    limit = 50,
  ): Promise<RetrievalQueryLogDto[]> {
    const rows = await this.prisma.retrievalQueryLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      query: row.query,
      source: row.source as RetrievalQueryLogDto["source"],
      topK: row.topK,
      ...(row.retrievalTimeMs !== null ? { retrievalTimeMs: row.retrievalTimeMs } : {}),
      ...(Array.isArray(row.retrievedChunks)
        ? { retrievedChunks: row.retrievedChunks as RetrievalQueryLogDto["retrievedChunks"] }
        : {}),
      success: row.success,
      ...(row.error ? { error: row.error } : {}),
      ...(row.createdBy ? { createdBy: row.createdBy } : {}),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async logRetrieval(input: {
    projectId: string;
    query: string;
    source: "generation" | "diagnostic" | "chat-rag";
    topK: number;
    retrievalTimeMs?: number;
    retrieved?: Array<{ chunkId: string; score?: number; filename?: string; section?: string }>;
    success: boolean;
    error?: string;
    createdBy?: string;
  }) {
    try {
      await this.prisma.retrievalQueryLog.create({
        data: {
          projectId: input.projectId,
          query: input.query.slice(0, 1000),
          source: input.source,
          topK: input.topK,
          ...(input.retrievalTimeMs !== undefined ? { retrievalTimeMs: input.retrievalTimeMs } : {}),
          ...(input.retrieved ? { retrievedChunks: input.retrieved as never } : {}),
          success: input.success,
          ...(input.error ? { error: input.error.slice(0, 500) } : {}),
          ...(input.createdBy ? { createdBy: input.createdBy } : {}),
        },
      });
    } catch {
      // Logging is best-effort; never fail retrieval because of a logging error.
    }
  }

  private async getDocumentDto(projectId: string, kbId: string, documentId: string): Promise<KnowledgeDocumentDto> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, knowledgeBaseId: kbId, knowledgeBase: { projectId } },
      include: { _count: { select: { chunks: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");
    return this.toDocumentDto(doc);
  }

  private async ensureKnowledgeBase(projectId: string, kbId: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, projectId } });
    if (!kb) throw new NotFoundException("Knowledge base not found");
    return kb;
  }

  private async ensureDocument(projectId: string, kbId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, knowledgeBaseId: kbId, knowledgeBase: { projectId } },
    });
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  private async enrichChunkOwnership(projectId: string, chunks: RetrievedChunk[]) {
    const enriched = await Promise.all(
      chunks.map(async (c) => {
        const chunk = await this.findProjectChunk(projectId, c.chunkId);
        if (!chunk) return null;
        const metadata = asRecord(chunk.sourceMetadata);
        return {
          chunkId: c.chunkId,
          source: toSourceAttribution(c.chunkId, chunk.document.id, chunk.document.filename, metadata, c.score),
        };
      }),
    );
    return enriched.filter((item): item is { chunkId: string; source: KnowledgeSourceAttributionDto } => item !== null);
  }

  private findProjectChunk(projectId: string, chunkId: string) {
    return this.prisma.documentChunk.findFirst({
      where: { id: chunkId, document: { knowledgeBase: { projectId } } },
      include: { document: { select: { id: true, filename: true } } },
    });
  }

  private toKnowledgeBaseDto(row: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { documents?: number };
  }): KnowledgeBaseDto {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description ?? undefined,
      documentCount: row._count?.documents ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDocumentDto(row: {
    id: string;
    knowledgeBaseId: string;
    filename: string;
    mimeType: string;
    sizeBytes: bigint;
    checksum: string;
    status: string;
    sourceMetadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    _count?: { chunks?: number };
  }): KnowledgeDocumentDto {
    return {
      id: row.id,
      knowledgeBaseId: row.knowledgeBaseId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      checksum: row.checksum,
      status: row.status as KnowledgeDocumentDto["status"],
      sourceMetadata: asRecord(row.sourceMetadata),
      chunkCount: row._count?.chunks ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toChunkDto(row: {
    id: string;
    documentId: string;
    order: number;
    text: string;
    sourceMetadata: unknown;
    tokenCount: number;
    createdAt: Date;
    embeddingRef?: { id: string } | null;
  }): KnowledgeChunkDto {
    return {
      id: row.id,
      documentId: row.documentId,
      order: row.order,
      textPreview: preview(row.text),
      tokenCount: row.tokenCount,
      sourceMetadata: asRecord(row.sourceMetadata),
      hasEmbedding: !!row.embeddingRef,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Naive chunker: split on paragraphs, cap source metadata to paragraph/page. */
  private chunkText(content: string): Array<{ text: string; tokenCount: number; section?: string; page?: number }> {
    const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const chunks: Array<{ text: string; tokenCount: number; section?: string; page?: number }> = [];
    let page = 1;
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i]!;
      const tokenCount = Math.ceil(text.split(/\s+/).length * 1.3);
      chunks.push({ text, tokenCount, section: `paragraph-${i + 1}`, page });
      if ((i + 1) % 5 === 0) page++;
    }
    if (chunks.length === 0 && content.trim()) {
      chunks.push({ text: content.trim(), tokenCount: Math.ceil(content.split(/\s+/).length * 1.3), section: "full", page: 1 });
    }
    return chunks;
  }
}

function toSourceAttribution(
  chunkId: string,
  documentId: string | undefined,
  filename: string | undefined,
  metadata: Record<string, unknown> | undefined,
  score?: number,
): KnowledgeSourceAttributionDto {
  return {
    chunkId,
    documentId,
    filename: filename ?? (metadata?.filename as string | undefined),
    section: metadata?.section as string | undefined,
    page: typeof metadata?.page === "number" ? metadata.page : undefined,
    score,
  };
}

function preview(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
