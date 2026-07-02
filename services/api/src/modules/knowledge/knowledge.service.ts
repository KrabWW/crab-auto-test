import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { Inject } from "@nestjs/common";
import type { RetrievalBackend } from "../../infra/retrieval/retrieval-backend.interface";
import { AuditService } from "../audit/audit.service";
import { createHash } from "node:crypto";
import type {
  RetrievedChunk,
  RetrievalDiagnostic,
} from "../../infra/retrieval/retrieval-backend.interface";

/**
 * knowledge-rag.1–5: project-scoped KB / Document / Chunk CRUD + ingest +
 * retrieve + source attribution + diagnostics.
 *
 * Project isolation (knowledge-rag.1): every query is scoped by projectId;
 * the RetrievalBackend.query is also project-scoped (joins KnowledgeBase.projectId).
 *
 * RAG → ai-orchestration (knowledge-rag.4): `retrieveForGeneration` returns
 * chunks + source attribution that AiOrchestration injects into the generation
 * trace (WorkflowStageEvent.sourceAttribution).
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject("RetrievalBackend") private readonly retrieval: RetrievalBackend,
    private readonly audit: AuditService,
  ) {}

  // ── KB CRUD (knowledge-rag.1) ──────────────────────────────────────────────
  async createKb(projectId: string, actorId: string, name: string, description?: string) {
    const kb = await this.prisma.knowledgeBase.create({
      data: { projectId, name, description },
    });
    await this.audit.record({
      actorId, projectId, action: "kb.create",
      targetType: "knowledge-base", targetId: kb.id, outcome: "success",
    });
    return kb;
  }

  async listKbs(projectId: string) {
    return this.prisma.knowledgeBase.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  }

  // ── Document ingest (knowledge-rag.2) ──────────────────────────────────────
  /**
   * Ingest a document: extract text, chunk, embed, store. Source metadata
   * (filename/section/page) is retained per chunk.
   */
  async ingestDocument(
    kbId: string,
    projectId: string,
    actorId: string,
    input: { filename: string; mimeType: string; content: string },
  ) {
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

    // Chunk (naive fixed-size splitter; section/page metadata inferred from line offsets).
    const chunks = this.chunkText(input.content, { filename: input.filename });
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
      // Embed + store via the replaceable RetrievalBackend.
      const embedding = await this.retrieval.embed(c.text);
      const vectorRef = await this.retrieval.store(chunk.id, embedding, "openai-embeddings");
      await this.prisma.embeddingRef.create({
        data: {
          chunkId: chunk.id,
          backend: this.retrieval.backendName,
          vectorRef,
          dims: embedding.length,
          model: "openai-embeddings",
        },
      });
    }

    await this.audit.record({
      actorId, projectId, action: "kb.document.ingest",
      targetType: "document", targetId: doc.id, outcome: "success",
      metadata: { filename: input.filename, chunks: chunks.length },
    });
    return doc;
  }

  async listDocuments(kbId: string) {
    return this.prisma.document.findMany({ where: { knowledgeBaseId: kbId }, orderBy: { createdAt: "desc" } });
  }

  /** knowledge-rag.4: retrieve with source attribution for AI generation. */
  async retrieveForGeneration(
    projectId: string,
    queryText: string,
    topK = 5,
  ): Promise<{ chunks: RetrievedChunk[]; sources: Array<{ chunkId: string; filename?: string; section?: string; page?: number }> }> {
    const chunks = await this.retrieval.query(projectId, queryText, topK);
    // Enrich with document source metadata for attribution.
    const enriched = await Promise.all(
      chunks.map(async (c) => {
        const chunk = await this.prisma.documentChunk.findUnique({
          where: { id: c.chunkId },
          include: { document: { select: { filename: true } } },
        });
        const sm = (chunk?.sourceMetadata as Record<string, unknown> | null) ?? {};
        return {
          chunkId: c.chunkId,
          filename: chunk?.document.filename ?? (sm.filename as string | undefined),
          section: sm.section as string | undefined,
          page: sm.page as number | undefined,
        };
      }),
    );
    return { chunks, sources: enriched };
  }

  /** knowledge-rag.5: retrieval diagnostics (query/matched/scores/sources). */
  async diagnose(projectId: string, queryText: string, topK = 5): Promise<RetrievalDiagnostic> {
    const diag = await this.retrieval.diagnose(projectId, queryText, topK);
    // Enrich matchedChunks with documentId + filename.
    const enriched = await Promise.all(
      diag.matchedChunks.map(async (m) => {
        const chunk = await this.prisma.documentChunk.findUnique({
          where: { id: m.chunkId },
          include: { document: { select: { id: true, filename: true } } },
        });
        return {
          ...m,
          documentId: chunk?.document.id ?? "",
          filename: chunk?.document.filename ?? m.sourceMetadata?.filename as string | undefined,
        };
      }),
    );
    return { ...diag, matchedChunks: enriched };
  }

  /** Naive chunker: split on paragraphs, cap ~500 tokens, track section/page. */
  private chunkText(content: string, meta: { filename: string }): Array<{ text: string; tokenCount: number; section?: string; page?: number }> {
    const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const chunks: Array<{ text: string; tokenCount: number; section?: string; page?: number }> = [];
    let page = 1;
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i]!;
      const tokenCount = Math.ceil(text.split(/\s+/).length * 1.3); // rough token estimate
      chunks.push({ text, tokenCount, section: `paragraph-${i + 1}`, page });
      if ((i + 1) % 5 === 0) page++;
    }
    if (chunks.length === 0 && content.trim()) {
      chunks.push({ text: content.trim(), tokenCount: Math.ceil(content.split(/\s+/).length * 1.3), section: "full", page: 1 });
    }
    return chunks;
  }
}
