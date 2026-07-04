import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  RequirementDocumentDto,
  RequirementDocumentKind,
  RequirementDocumentStatus,
} from "@crab/shared-types";

const ALLOWED_MIME: Record<RequirementDocumentKind, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  txt: ["text/plain"],
  md: ["text/markdown", "text/x-markdown"],
  html: ["text/html"],
};

const EXT_TO_KIND: Record<string, RequirementDocumentKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".html": "html",
  ".htm": "html",
};

interface RequirementDocumentRow {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: bigint;
  checksum: string;
  storageRef: string;
  status: string;
  parsedText: string | null;
  parseError: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class RequirementDocumentsService {
  private readonly logger = new Logger(RequirementDocumentsService.name);
  private readonly uploadRoot = resolve(process.cwd(), "data", "requirement-docs");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<RequirementDocumentDto[]> {
    const rows = await this.prisma.requirementDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row, false));
  }

  async get(projectId: string, docId: string, includeText = false): Promise<RequirementDocumentDto> {
    const row = await this.prisma.requirementDocument.findFirst({
      where: { id: docId, projectId },
    });
    if (!row) throw new NotFoundException("Requirement document not found");
    return this.toDto(row, includeText);
  }

  async upload(
    projectId: string,
    actorId: string,
    field: MultipartFile,
  ): Promise<RequirementDocumentDto> {
    const filename = field.filename ?? "unnamed";
    const ext = extname(filename).toLowerCase();
    const kind = EXT_TO_KIND[ext];
    if (!kind) {
      throw new BadRequestException(
        `Unsupported file extension "${ext}". Allowed: pdf, docx, txt, md, html`,
      );
    }
    const mimeType = field.mimetype ?? ALLOWED_MIME[kind][0]!;
    if (!this.isAllowedMime(kind, mimeType)) {
      throw new BadRequestException(`File MIME type "${mimeType}" not allowed for "${ext}"`);
    }

    const buffer = await field.toBuffer();
    const sizeBytes = buffer.byteLength;
    if (sizeBytes === 0) {
      throw new BadRequestException("Uploaded file is empty");
    }
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const created = await this.prisma.requirementDocument.create({
      data: {
        projectId,
        filename,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksum,
        storageRef: "pending",
        status: "uploaded",
        uploadedBy: actorId,
      },
    });

    const storageRef = join(created.id, filename);
    const absPath = join(this.uploadRoot, projectId, storageRef);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, buffer);

    const stored = await this.prisma.requirementDocument.update({
      where: { id: created.id },
      data: { storageRef },
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "requirement-document.upload",
      targetType: "requirement-document",
      targetId: created.id,
      outcome: "success",
      metadata: { filename, sizeBytes, mimeType },
    });

    // Trigger extraction immediately to honor "upload → ready" UX flow.
    try {
      return await this.extract(projectId, created.id, actorId);
    } catch (err) {
      this.logger.warn(`Initial extract failed for ${created.id}: ${(err as Error).message}`);
      return this.toDto(stored, false);
    }
  }

  async extract(
    projectId: string,
    docId: string,
    actorId: string,
  ): Promise<RequirementDocumentDto> {
    const doc = await this.prisma.requirementDocument.findFirst({
      where: { id: docId, projectId },
    });
    if (!doc) throw new NotFoundException("Requirement document not found");

    await this.prisma.requirementDocument.update({
      where: { id: docId },
      data: { status: "processing", parseError: null },
    });

    try {
      const absPath = join(this.uploadRoot, projectId, doc.storageRef);
      const text = await this.extractText(absPath, doc.mimeType);
      const updated = await this.prisma.requirementDocument.update({
        where: { id: docId },
        data: { status: "extracted", parsedText: text },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "requirement-document.extract",
        targetType: "requirement-document",
        targetId: docId,
        outcome: "success",
        metadata: { chars: text.length },
      });
      return this.toDto(updated, true);
    } catch (err) {
      const parseError = (err as Error).message ?? "Unknown parse error";
      const updated = await this.prisma.requirementDocument.update({
        where: { id: docId },
        data: { status: "failed", parseError },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "requirement-document.extract",
        targetType: "requirement-document",
        targetId: docId,
        outcome: "failure",
        metadata: { error: parseError },
      });
      return this.toDto(updated, false);
    }
  }

  async delete(projectId: string, docId: string, actorId: string): Promise<void> {
    const doc = await this.prisma.requirementDocument.findFirst({
      where: { id: docId, projectId },
      select: { id: true, storageRef: true },
    });
    if (!doc) throw new NotFoundException("Requirement document not found");

    const absDir = join(this.uploadRoot, projectId, doc.id);
    await rm(absDir, { recursive: true, force: true }).catch(() => {
      /* best-effort fs cleanup */
    });

    await this.prisma.requirementDocument.delete({ where: { id: docId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "requirement-document.delete",
      targetType: "requirement-document",
      targetId: docId,
      outcome: "success",
    });
  }

  private async extractText(absPath: string, mimeType: string): Promise<string> {
    if (mimeType === "application/pdf") {
      const { default: pdfParse } = await import("pdf-parse");
      const buffer = await readFile(absPath);
      const result = await pdfParse(buffer);
      const text = (result.text ?? "").trim();
      if (!text) throw new Error("PDF contained no extractable text");
      return text;
    }
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/octet-stream"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: absPath });
      const text = (result.value ?? "").trim();
      if (!text) throw new Error("DOCX contained no extractable text");
      return text;
    }
    // txt / md / html — read as UTF-8 text.
    return readFile(absPath, "utf8");
  }

  private isAllowedMime(kind: RequirementDocumentKind, mimeType: string): boolean {
    if (ALLOWED_MIME[kind].includes(mimeType)) return true;
    // Many clients (curl, some browsers) send "application/octet-stream" as a
    // generic fallback MIME. Accept it for binary kinds where we already trust
    // the file extension. Text kinds (txt/md/html) require a real text MIME.
    if (mimeType === "application/octet-stream") {
      return kind === "pdf" || kind === "docx";
    }
    return false;
  }

  private toDto(row: RequirementDocumentRow, includeText: boolean): RequirementDocumentDto {
    const status = this.toStatus(row.status);
    return {
      id: row.id,
      projectId: row.projectId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      checksum: row.checksum,
      status,
      ...(includeText && row.parsedText ? { parsedText: row.parsedText } : {}),
      ...(row.parseError ? { parseError: row.parseError } : {}),
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toStatus(value: string): RequirementDocumentStatus {
    if (value === "uploaded" || value === "processing" || value === "extracted" || value === "failed") {
      return value;
    }
    return "uploaded";
  }
}
