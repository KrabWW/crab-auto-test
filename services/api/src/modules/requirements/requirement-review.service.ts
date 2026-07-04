import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LlmDraftService } from "../ai-orchestration/llm-draft.service";
import type {
  RequirementReviewIssue,
  RequirementReviewReportDto,
  RequirementReviewStatus,
} from "@crab/shared-types";

const REPORT_STATUSES = new Set<RequirementReviewStatus>([
  "pending",
  "running",
  "completed",
  "failed",
]);

interface ReportRow {
  id: string;
  documentId: string;
  projectId: string;
  status: string;
  overallScore: number | null;
  clarityScore: number | null;
  completenessScore: number | null;
  testabilityScore: number | null;
  boundariesScore: number | null;
  issues: unknown;
  improvements: unknown;
  modelUsed: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  failureReason: string | null;
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class RequirementReviewService {
  private readonly logger = new Logger(RequirementReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly llmDraft: LlmDraftService,
  ) {}

  async listReports(
    projectId: string,
    docId?: string,
  ): Promise<RequirementReviewReportDto[]> {
    const rows = await this.prisma.requirementReviewReport.findMany({
      where: { projectId, ...(docId ? { documentId: docId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row as unknown as ReportRow));
  }

  async getReport(
    projectId: string,
    reportId: string,
  ): Promise<RequirementReviewReportDto> {
    const row = await this.prisma.requirementReviewReport.findFirst({
      where: { id: reportId, projectId },
    });
    if (!row) throw new NotFoundException("Review report not found");
    return this.toDto(row as unknown as ReportRow);
  }

  async startReview(
    projectId: string,
    docId: string,
    actorId: string,
    providerId?: string,
  ): Promise<RequirementReviewReportDto> {
    const doc = await this.prisma.requirementDocument.findFirst({
      where: { id: docId, projectId },
    });
    if (!doc) throw new NotFoundException("Requirement document not found");
    if (!doc.parsedText || doc.status !== "extracted") {
      throw new BadRequestException(
        "Document text must be extracted before AI review.",
      );
    }

    const report = await this.prisma.requirementReviewReport.create({
      data: {
        documentId: docId,
        projectId,
        status: "running",
        startedAt: new Date(),
        createdBy: actorId,
      },
    });

    try {
      const { result, modelUsed } = await this.llmDraft.reviewDocument(
        providerId,
        doc.parsedText,
        projectId,
      );
      const updated = await this.prisma.requirementReviewReport.update({
        where: { id: report.id },
        data: {
          status: "completed",
          overallScore: result.overallScore,
          clarityScore: result.clarityScore,
          completenessScore: result.completenessScore,
          testabilityScore: result.testabilityScore,
          boundariesScore: result.boundariesScore,
          issues: result.issues as unknown as object,
          improvements: result.improvements as unknown as object,
          modelUsed,
          finishedAt: new Date(),
        },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "requirement-review.start",
        targetType: "requirement-review-report",
        targetId: report.id,
        outcome: "success",
        metadata: { documentId: docId, model: modelUsed },
      });
      return this.toDto(updated as unknown as ReportRow);
    } catch (err) {
      const reason = (err as Error).message ?? "Unknown review error";
      const updated = await this.prisma.requirementReviewReport.update({
        where: { id: report.id },
        data: {
          status: "failed",
          failureReason: reason,
          finishedAt: new Date(),
        },
      });
      await this.audit.record({
        actorId,
        projectId,
        action: "requirement-review.start",
        targetType: "requirement-review-report",
        targetId: report.id,
        outcome: "failure",
        metadata: { documentId: docId, error: reason },
      });
      return this.toDto(updated as unknown as ReportRow);
    }
  }

  private toDto(row: ReportRow): RequirementReviewReportDto {
    const status = REPORT_STATUSES.has(row.status as RequirementReviewStatus)
      ? (row.status as RequirementReviewStatus)
      : "pending";
    const issues = Array.isArray(row.issues)
      ? (row.issues as RequirementReviewIssue[])
      : undefined;
    const improvements = Array.isArray(row.improvements)
      ? (row.improvements as string[])
      : undefined;
    return {
      id: row.id,
      documentId: row.documentId,
      projectId: row.projectId,
      status,
      ...(row.overallScore !== null ? { overallScore: row.overallScore } : {}),
      ...(row.clarityScore !== null ? { clarityScore: row.clarityScore } : {}),
      ...(row.completenessScore !== null
        ? { completenessScore: row.completenessScore }
        : {}),
      ...(row.testabilityScore !== null
        ? { testabilityScore: row.testabilityScore }
        : {}),
      ...(row.boundariesScore !== null
        ? { boundariesScore: row.boundariesScore }
        : {}),
      ...(issues ? { issues } : {}),
      ...(improvements ? { improvements } : {}),
      ...(row.modelUsed ? { modelUsed: row.modelUsed } : {}),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      ...(row.failureReason ? { failureReason: row.failureReason } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
