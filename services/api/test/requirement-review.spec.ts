import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RequirementReviewService } from "../src/modules/requirements/requirement-review.service";

function makeService(prisma: Record<string, unknown>, llmDraft: Record<string, unknown> = {}) {
  return new RequirementReviewService(prisma as never, { record: vi.fn() } as never, llmDraft as never);
}

describe("requirement review", () => {
  it("listReports returns rows in order", async () => {
    const rows = [
      { id: "rep-1", documentId: "doc-1", projectId: "p", status: "completed", overallScore: 80, clarityScore: 80, completenessScore: 80, testabilityScore: 80, boundariesScore: 80, issues: [], improvements: [], modelUsed: "stub", startedAt: new Date(), finishedAt: new Date(), failureReason: null, createdBy: "u", createdAt: new Date() },
    ];
    const svc = makeService({
      requirementReviewReport: { findMany: vi.fn().mockResolvedValue(rows) },
    });
    const result = await svc.listReports("p", "doc-1");
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("completed");
    expect(result[0]!.overallScore).toBe(80);
  });

  it("getReport 404 when missing", async () => {
    const svc = makeService({
      requirementReviewReport: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.getReport("p", "rep-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("startReview rejects when document not extracted", async () => {
    const svc = makeService({
      requirementDocument: { findFirst: vi.fn().mockResolvedValue({ id: "doc-1", parsedText: null, status: "uploaded" }) },
    });
    await expect(svc.startReview("p", "doc-1", "u")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("startReview persists completed report with scores and issues", async () => {
    const created = { id: "rep-1", documentId: "doc-1", projectId: "p", status: "running", overallScore: null, clarityScore: null, completenessScore: null, testabilityScore: null, boundariesScore: null, issues: null, improvements: null, modelUsed: null, startedAt: new Date(), finishedAt: null, failureReason: null, createdBy: "u", createdAt: new Date() };
    const updated = {
      ...created,
      status: "completed",
      overallScore: 82,
      clarityScore: 80,
      completenessScore: 85,
      testabilityScore: 78,
      boundariesScore: 84,
      issues: [{ severity: "high", message: "Ambiguous input" }],
      improvements: ["Add explicit boundary for user roles"],
      modelUsed: "stub-model",
      finishedAt: new Date(),
    };
    const svc = makeService(
      {
        requirementDocument: { findFirst: vi.fn().mockResolvedValue({ id: "doc-1", projectId: "p", parsedText: "text", status: "extracted" }) },
        requirementReviewReport: {
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn().mockResolvedValue(updated),
        },
      },
      {
        reviewDocument: vi.fn().mockResolvedValue({
          result: {
            overallScore: 82,
            clarityScore: 80,
            completenessScore: 85,
            testabilityScore: 78,
            boundariesScore: 84,
            issues: [{ severity: "high", message: "Ambiguous input" }],
            improvements: ["Add explicit boundary for user roles"],
          },
          modelUsed: "stub-model",
        }),
      },
    );

    const dto = await svc.startReview("p", "doc-1", "u");
    expect(dto.status).toBe("completed");
    expect(dto.overallScore).toBe(82);
    expect(dto.issues).toHaveLength(1);
  });

  it("startReview records failure when LLM throws", async () => {
    const created = { id: "rep-1", documentId: "doc-1", projectId: "p", status: "running", overallScore: null, clarityScore: null, completenessScore: null, testabilityScore: null, boundariesScore: null, issues: null, improvements: null, modelUsed: null, startedAt: new Date(), finishedAt: null, failureReason: null, createdBy: "u", createdAt: new Date() };
    const updated = { ...created, status: "failed", failureReason: "boom", finishedAt: new Date() };
    const svc = makeService(
      {
        requirementDocument: { findFirst: vi.fn().mockResolvedValue({ id: "doc-1", projectId: "p", parsedText: "text", status: "extracted" }) },
        requirementReviewReport: {
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn().mockResolvedValue(updated),
        },
      },
      {
        reviewDocument: vi.fn().mockRejectedValue(new Error("boom")),
      },
    );

    const dto = await svc.startReview("p", "doc-1", "u");
    expect(dto.status).toBe("failed");
    expect(dto.failureReason).toBe("boom");
  });
});
