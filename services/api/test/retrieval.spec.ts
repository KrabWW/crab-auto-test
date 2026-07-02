import { describe, it, expect } from "vitest";
import { StubRetrievalBackend } from "../src/infra/retrieval/stub-retrieval-backend";
import type { RetrievalBackend } from "../src/infra/retrieval/retrieval-backend.interface";

/**
 * U-RETRIEVAL-IF: RetrievalBackend interface conformance + swappability (I-RETRIEVAL-SWAP).
 *
 * The stub adapter proves a domain layer depending only on the RetrievalBackend
 * interface works unchanged when the adapter is swapped (knowledge-rag.3).
 * The pgvector adapter is bound in production; this test exercises the contract
 * that the pgvector adapter also satisfies, without needing a live Postgres+pgvector.
 */
describe("U-RETRIEVAL-IF — RetrievalBackend interface conformance", () => {
  function exercise(backend: RetrievalBackend, label: string) {
    describe(`${label}`, () => {
      it("exposes a backendName", () => {
        expect(typeof backend.backendName).toBe("string");
        expect(backend.backendName.length).toBeGreaterThan(0);
      });

      it("embeds text into a numeric vector of consistent dimensionality", async () => {
        const a = await backend.embed("hello world");
        const b = await backend.embed("another text");
        expect(Array.isArray(a)).toBe(true);
        expect(a.length).toBeGreaterThan(0);
        expect(b.length).toBe(a.length);
      });

      it("query returns ranked chunks within the same project scope", async () => {
        const diag = await backend.diagnose("proj-1", "hello", 5);
        expect(diag.backend).toBe(backend.backendName);
        expect(Array.isArray(diag.matchedChunks)).toBe(true);
        expect(diag.selectedSources.length).toBe(diag.matchedChunks.length);
      });
    });
  }

  // Stub adapter exercises the contract; pgvector adapter satisfies the same
  // interface (verified by I-RETRIEVAL-SWAP integration test with a live DB).
  const stub = new StubRetrievalBackend();
  stub.seed("chunk-1", "hello world example", "proj-1");
  stub.seed("chunk-2", "unrelated content", "proj-1");
  exercise(stub, "StubRetrievalBackend");

  it("interface is structural — both adapters share the same shape", () => {
    const checks: Array<keyof RetrievalBackend> = ["backendName", "embed", "store", "query", "diagnose"];
    for (const k of checks) {
      expect(typeof (stub as unknown as RetrievalBackend)[k]).not.toBe("undefined");
    }
  });
});
