import { Global, Module } from "@nestjs/common";
import { RetrievalBackendService } from "./retrieval-backend.service";

/**
 * R9 / knowledge-rag.3: replaceable retrieval backend.
 *
 * The interface is what AI workflows depend on; the concrete adapter is
 * swappable. pgvector is the first implementation (A1 decision); a stub
 * adapter proves swappability without a second stateful service (§11 b′5).
 */
@Global()
@Module({
  providers: [{ provide: "RetrievalBackend", useClass: RetrievalBackendService }],
  exports: ["RetrievalBackend"],
})
export class RetrievalModule {}
