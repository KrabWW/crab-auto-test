import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { CreateKnowledgeBaseRequest, IngestKnowledgeDocumentRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get("knowledge-bases")
  listKbs(@Param("projectId") projectId: string) {
    return this.knowledge.listKbs(projectId);
  }

  @Post("knowledge-bases")
  createKb(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateKnowledgeBaseRequest,
  ) {
    if (!body?.name) throw new BadRequestException("name required");
    return this.knowledge.createKb(projectId, user.userId, body.name, body.description);
  }

  @Get("knowledge-bases/:kbId/documents")
  listDocs(@Param("projectId") projectId: string, @Param("kbId") kbId: string) {
    return this.knowledge.listDocuments(projectId, kbId);
  }

  @Post("knowledge-bases/:kbId/documents")
  ingest(
    @Param("projectId") projectId: string,
    @Param("kbId") kbId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: IngestKnowledgeDocumentRequest,
  ) {
    if (!body?.filename || !body?.content) throw new BadRequestException("filename + content required");
    return this.knowledge.ingestDocument(kbId, projectId, user.userId, body);
  }

  @Get("knowledge-bases/:kbId/documents/:documentId/chunks")
  chunks(
    @Param("projectId") projectId: string,
    @Param("kbId") kbId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.knowledge.listDocumentChunks(projectId, kbId, documentId);
  }

  /** knowledge-rag.5 diagnostics endpoint. */
  @Post("retrieval/query")
  diagnose(
    @Param("projectId") projectId: string,
    @Body() body: { query: string; topK?: number },
  ) {
    if (!body?.query) throw new BadRequestException("query required");
    return this.knowledge.diagnose(projectId, body.query, body.topK ?? 5);
  }

  /** knowledge-rag.4 retrieve-for-generation (used by ai-orchestration + UI). */
  @Get("retrieval")
  retrieve(
    @Param("projectId") projectId: string,
    @Query("q") q: string,
    @Query("topK") topK?: string,
  ) {
    if (!q) throw new BadRequestException("q required");
    return this.knowledge.retrieveForGeneration(projectId, q, topK ? Number(topK) : 5);
  }
}
