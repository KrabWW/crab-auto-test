import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeService } from "../src/modules/knowledge/knowledge.service";

const now = new Date("2026-01-01T00:00:00.000Z");

function makeService(prisma: Record<string, unknown>, retrieval: Record<string, unknown> = {}) {
  return new KnowledgeService(
    prisma as never,
    {
      backendName: "stub",
      embed: vi.fn(),
      store: vi.fn(),
      query: vi.fn(),
      diagnose: vi.fn(),
      ...retrieval,
    } as never,
    { record: vi.fn() } as never,
  );
}

function kbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "kb-1",
    projectId: "project-a",
    name: "Product docs",
    description: "requirements",
    createdAt: now,
    updatedAt: now,
    _count: { documents: 1 },
    ...overrides,
  };
}

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    knowledgeBaseId: "kb-1",
    filename: "requirements.txt",
    mimeType: "text/plain",
    sizeBytes: BigInt(42),
    checksum: "abc123",
    status: "ingested",
    sourceMetadata: { filename: "requirements.txt", mimeType: "text/plain" },
    createdAt: now,
    updatedAt: now,
    _count: { chunks: 2 },
    ...overrides,
  };
}

function chunkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "chunk-1",
    documentId: "doc-1",
    order: 0,
    text: "Checkout users can export reports with source attribution.",
    tokenCount: 9,
    sourceMetadata: { filename: "requirements.txt", section: "paragraph-1", page: 1 },
    createdAt: now,
    embeddingRef: { id: "embedding-1" },
    document: { id: "doc-1", filename: "requirements.txt" },
    ...overrides,
  };
}

describe("knowledge polish", () => {
  it("lists documents only after confirming the KB belongs to the route project", async () => {
    const findFirst = vi.fn().mockResolvedValue(kbRow());
    const findMany = vi.fn().mockResolvedValue([docRow()]);
    const service = makeService({
      knowledgeBase: { findFirst },
      document: { findMany },
    });

    const docs = await service.listDocuments("project-a", "kb-1");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "kb-1", projectId: "project-a" } });
    expect(findMany).toHaveBeenCalledWith({
      where: { knowledgeBaseId: "kb-1" },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    });
    expect(docs[0]).toMatchObject({ filename: "requirements.txt", sizeBytes: 42, chunkCount: 2 });
  });

  it("rejects document reads for a KB outside the route project", async () => {
    const findMany = vi.fn();
    const service = makeService({
      knowledgeBase: { findFirst: vi.fn().mockResolvedValue(null) },
      document: { findMany },
    });

    await expect(service.listDocuments("project-b", "kb-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns ordered chunk summaries with source metadata and embedding state", async () => {
    const findMany = vi.fn().mockResolvedValue([chunkRow()]);
    const service = makeService({
      document: { findFirst: vi.fn().mockResolvedValue(docRow()) },
      documentChunk: { findMany },
    });

    const chunks = await service.listDocumentChunks("project-a", "kb-1", "doc-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { documentId: "doc-1" },
      include: { embeddingRef: { select: { id: true } } },
      orderBy: { order: "asc" },
    });
    expect(chunks[0]).toMatchObject({
      order: 0,
      hasEmbedding: true,
      sourceMetadata: { section: "paragraph-1", page: 1 },
    });
    expect(chunks[0]?.textPreview).toContain("source attribution");
  });

  it("enriches diagnostics with text previews and selected source attribution", async () => {
    const service = makeService(
      { documentChunk: { findFirst: vi.fn().mockResolvedValue(chunkRow()) } },
      {
        diagnose: vi.fn().mockResolvedValue({
          query: "export report",
          matchedChunks: [{ chunkId: "chunk-1", score: 0.92, documentId: "", sourceMetadata: { section: "paragraph-1", page: 1 } }],
          selectedSources: ["chunk-1"],
          backend: "stub",
          model: "stub",
        }),
      },
    );

    const diag = await service.diagnose("project-a", "export report", 3);

    expect(diag.matchedChunks[0]).toMatchObject({
      documentId: "doc-1",
      filename: "requirements.txt",
      textPreview: "Checkout users can export reports with source attribution.",
    });
    expect(diag.selectedSources[0]).toMatchObject({
      chunkId: "chunk-1",
      documentId: "doc-1",
      filename: "requirements.txt",
      section: "paragraph-1",
      page: 1,
      score: 0.92,
    });
  });

  it("filters diagnostic matches that cannot be confirmed in the current project", async () => {
    const service = makeService(
      {
        documentChunk: {
          findFirst: vi.fn().mockResolvedValueOnce(chunkRow()).mockResolvedValueOnce(null),
        },
      },
      {
        diagnose: vi.fn().mockResolvedValue({
          query: "export report",
          matchedChunks: [
            { chunkId: "chunk-1", score: 0.92, documentId: "", sourceMetadata: { section: "paragraph-1", page: 1 } },
            {
              chunkId: "chunk-cross-project",
              score: 0.88,
              documentId: "",
              sourceMetadata: { filename: "other-project-secret.txt", section: "private" },
            },
          ],
          selectedSources: ["chunk-1", "chunk-cross-project"],
          backend: "stub",
          model: "stub",
        }),
      },
    );

    const diag = await service.diagnose("project-a", "export report", 5);

    expect(diag.matchedChunks).toHaveLength(1);
    expect(diag.matchedChunks[0]).toMatchObject({ chunkId: "chunk-1", filename: "requirements.txt" });
    expect(diag.selectedSources).toHaveLength(1);
    expect(JSON.stringify(diag)).not.toContain("other-project-secret.txt");
    expect(JSON.stringify(diag)).not.toContain("chunk-cross-project");
  });

  it("filters retrieval results to chunks confirmed in the current project", async () => {
    const service = makeService(
      {
        documentChunk: {
          findFirst: vi.fn().mockResolvedValueOnce(chunkRow()).mockResolvedValueOnce(null),
        },
      },
      {
        query: vi.fn().mockResolvedValue([
          { chunkId: "chunk-1", text: "allowed", score: 0.9 },
          { chunkId: "chunk-cross-project", text: "blocked", score: 0.8 },
        ]),
      },
    );

    const result = await service.retrieveForGeneration("project-a", "export report", 5);

    expect(result.chunks).toEqual([{ chunkId: "chunk-1", text: "allowed", score: 0.9 }]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ chunkId: "chunk-1", filename: "requirements.txt" });
  });
});
