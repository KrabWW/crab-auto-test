import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { RequirementDocumentsService } from "./requirement-documents.service";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class RequirementDocumentsController {
  constructor(private readonly documents: RequirementDocumentsService) {}

  @Get("requirements/documents")
  list(@Param("projectId") projectId: string) {
    return this.documents.list(projectId);
  }

  @Get("requirements/documents/:docId")
  get(@Param("projectId") projectId: string, @Param("docId") docId: string) {
    return this.documents.get(projectId, docId, true);
  }

  @Post("requirements/documents")
  async upload(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Req() req: FastifyRequest,
  ) {
    // req.file() is provided by @fastify/multipart; cast bypasses FastifyRequest
    // type that doesn't know about multipart augmentation in this file's scope.
    const file = await (req as unknown as { file: () => Promise<unknown> }).file();
    if (!file || typeof (file as { toBuffer?: unknown }).toBuffer !== "function") {
      throw new BadRequestException("No file uploaded. Expected a single multipart file.");
    }
    return this.documents.upload(projectId, user.userId, file as never);
  }

  @Delete("requirements/documents/:docId")
  async delete(
    @Param("projectId") projectId: string,
    @Param("docId") docId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.documents.delete(projectId, docId, user.userId);
    return { ok: true };
  }

  @Post("requirements/documents/:docId/extract")
  extract(
    @Param("projectId") projectId: string,
    @Param("docId") docId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documents.extract(projectId, docId, user.userId);
  }
}
