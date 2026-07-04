import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RequirementsService } from "../src/modules/requirements/requirements.service";
import { AiOrchestrationService } from "../src/modules/ai-orchestration/ai-orchestration.service";
import { TestAssetsService } from "../src/modules/test-assets/test-assets.service";

function requirementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    projectId: "project-a",
    title: "Checkout",
    content: "Buyer can check out",
    status: "draft",
    version: 1,
    createdBy: "user-a",
    reviewedBy: null,
    approvedBy: null,
    rejectedBy: null,
    archivedBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    versions: [
      {
        id: "ver-1",
        requirementId: "req-1",
        projectId: "project-a",
        version: 1,
        title: "Checkout",
        content: "Buyer can check out",
        status: "draft",
        createdBy: "user-a",
        reviewedAt: null,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        archivedAt: null,
        archivedBy: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    events: [],
    ...overrides,
  };
}

function makeRequirementsService(prisma: Record<string, unknown>) {
  return new RequirementsService(prisma as never, { record: vi.fn() } as never);
}

describe("requirements workflow", () => {
  it("creates draft requirements with version and review record", async () => {
    const row = requirementRow({
      events: [
        {
          id: "evt-1",
          requirementId: "req-1",
          projectId: "project-a",
          fromStatus: null,
          toStatus: "draft",
          action: "create",
          actorId: "user-a",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    const tx = {
      requirement: {
        create: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      },
      requirementVersion: { create: vi.fn().mockResolvedValue(row.versions[0]) },
      requirementReviewEvent: { create: vi.fn().mockResolvedValue(row.events[0]) },
    };
    const svc = makeRequirementsService({ $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx) });

    const dto = await svc.create("project-a", "user-a", { title: "Checkout", content: "Buyer can check out" });

    expect(dto.status).toBe("draft");
    expect(dto.version).toBe(1);
    expect(dto.versions).toHaveLength(1);
    expect(dto.reviewEvents[0]).toMatchObject({ action: "create", toStatus: "draft" });
  });

  it("lets only project owners approve in-review requirements", async () => {
    const reviewed = requirementRow({ status: "in-review", reviewedBy: "user-b" });
    const approved = requirementRow({
      status: "approved",
      reviewedBy: "user-b",
      approvedBy: "owner-a",
      versions: [{ ...reviewed.versions[0], status: "approved", approvedBy: "owner-a", approvedAt: new Date("2026-01-01T00:01:00.000Z") }],
      events: [
        {
          id: "evt-2",
          requirementId: "req-1",
          projectId: "project-a",
          fromStatus: "in-review",
          toStatus: "approved",
          action: "approve",
          actorId: "owner-a",
          createdAt: new Date("2026-01-01T00:01:00.000Z"),
        },
      ],
    });
    const tx = {
      requirement: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(approved) },
      requirementVersion: { update: vi.fn() },
      requirementReviewEvent: { create: vi.fn() },
    };
    const prisma = {
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) },
      requirement: { findFirst: vi.fn().mockResolvedValue(reviewed) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    };
    const svc = makeRequirementsService(prisma);

    const dto = await svc.approve("project-a", "req-1", "owner-a");

    expect(dto.status).toBe("approved");
    expect(tx.requirementReviewEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "approve", toStatus: "approved" }) }),
    );
  });

  it("rejects member approval without adding custom roles", async () => {
    const svc = makeRequirementsService({
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "member" }) },
    });

    await expect(svc.approve("project-a", "req-1", "member-a")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("revises approved requirements as a new draft version", async () => {
    const approved = requirementRow({ status: "approved", version: 1, approvedBy: "owner-a" });
    const revised = requirementRow({
      title: "Checkout revised",
      content: "Buyer can check out with a coupon",
      status: "draft",
      version: 2,
      approvedBy: null,
      versions: [
        { ...approved.versions[0], id: "ver-2", version: 2, title: "Checkout revised", content: "Buyer can check out with a coupon", status: "draft" },
        { ...approved.versions[0], status: "approved", approvedBy: "owner-a" },
      ],
      events: [],
    });
    const tx = {
      requirement: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(revised) },
      requirementVersion: { create: vi.fn() },
      requirementReviewEvent: { create: vi.fn() },
    };
    const svc = makeRequirementsService({
      requirement: { findFirst: vi.fn().mockResolvedValue(approved) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    });

    const dto = await svc.update("project-a", "req-1", "user-a", {
      title: "Checkout revised",
      content: "Buyer can check out with a coupon",
    });

    expect(dto.version).toBe(2);
    expect(dto.status).toBe("draft");
    expect(tx.requirementVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2, status: "draft" }) }),
    );
  });

  it("returns in-review requirements to draft when edited", async () => {
    const reviewed = requirementRow({ status: "in-review", reviewedBy: "reviewer-a" });
    const updatedDraft = requirementRow({
      title: "Checkout revised",
      content: "Buyer can check out after editing",
      status: "draft",
      reviewedBy: null,
      versions: [{ ...reviewed.versions[0], title: "Checkout revised", content: "Buyer can check out after editing", status: "draft" }],
      events: [
        {
          id: "evt-3",
          requirementId: "req-1",
          projectId: "project-a",
          fromStatus: "in-review",
          toStatus: "draft",
          action: "update",
          actorId: "user-a",
          createdAt: new Date("2026-01-01T00:02:00.000Z"),
        },
      ],
    });
    const tx = {
      requirement: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(updatedDraft) },
      requirementVersion: { update: vi.fn() },
      requirementReviewEvent: { create: vi.fn() },
    };
    const svc = makeRequirementsService({
      requirement: { findFirst: vi.fn().mockResolvedValue(reviewed) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    });

    const dto = await svc.update("project-a", "req-1", "user-a", {
      title: "Checkout revised",
      content: "Buyer can check out after editing",
    });

    expect(dto.status).toBe("draft");
    expect(tx.requirement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "draft", reviewedBy: null }) }),
    );
    expect(tx.requirementReviewEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fromStatus: "in-review", toStatus: "draft", action: "update" }) }),
    );
  });

  it("rejects in-review requirements when an owner calls reject", async () => {
    const inReview = requirementRow({ status: "in-review", reviewedBy: "user-b" });
    const rejected = requirementRow({
      status: "rejected",
      reviewedBy: "user-b",
      rejectedBy: "owner-a",
      versions: [{ ...inReview.versions[0], status: "rejected", rejectedBy: "owner-a", rejectedAt: new Date("2026-01-01T00:03:00.000Z") }],
      events: [
        {
          id: "evt-reject",
          requirementId: "req-1",
          projectId: "project-a",
          fromStatus: "in-review",
          toStatus: "rejected",
          action: "reject",
          actorId: "owner-a",
          createdAt: new Date("2026-01-01T00:03:00.000Z"),
        },
      ],
    });
    const tx = {
      requirement: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(rejected) },
      requirementVersion: { update: vi.fn() },
      requirementReviewEvent: { create: vi.fn() },
    };
    const prisma = {
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) },
      requirement: { findFirst: vi.fn().mockResolvedValue(inReview) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    };
    const svc = makeRequirementsService(prisma);

    const dto = await svc.reject("project-a", "req-1", "owner-a");

    expect(dto.status).toBe("rejected");
    expect(dto.rejectedBy).toBe("owner-a");
    expect(tx.requirementReviewEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "reject", toStatus: "rejected" }) }),
    );
  });

  it("archives non-approved requirements and records the event", async () => {
    const rejected = requirementRow({ status: "rejected", rejectedBy: "owner-a" });
    const archived = requirementRow({
      status: "archived",
      archivedBy: "user-a",
      versions: [{ ...rejected.versions[0], status: "archived", archivedBy: "user-a", archivedAt: new Date("2026-01-01T00:04:00.000Z") }],
      events: [
        {
          id: "evt-archive",
          requirementId: "req-1",
          projectId: "project-a",
          fromStatus: "rejected",
          toStatus: "archived",
          action: "archive",
          actorId: "user-a",
          createdAt: new Date("2026-01-01T00:04:00.000Z"),
        },
      ],
    });
    const tx = {
      requirement: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(archived) },
      requirementVersion: { update: vi.fn() },
      requirementReviewEvent: { create: vi.fn() },
    };
    const svc = makeRequirementsService({
      requirement: { findFirst: vi.fn().mockResolvedValue(rejected) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    });

    const dto = await svc.archive("project-a", "req-1", "user-a");

    expect(dto.status).toBe("archived");
    expect(dto.archivedBy).toBe("user-a");
  });

  it("deletes only deletable requirements and clears history", async () => {
    const archived = requirementRow({ status: "archived", archivedBy: "user-a" });
    const tx = {
      requirementReviewEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      requirementVersion: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      requirement: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const svc = makeRequirementsService({
      requirement: { findFirst: vi.fn().mockResolvedValue(archived) },
      $transaction: (cb: (tx: typeof tx) => unknown) => cb(tx),
    });

    await svc.delete("project-a", "req-1", "user-a");

    expect(tx.requirementReviewEvent.deleteMany).toHaveBeenCalledWith({ where: { requirementId: "req-1" } });
    expect(tx.requirementVersion.deleteMany).toHaveBeenCalledWith({ where: { requirementId: "req-1" } });
    expect(tx.requirement.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
  });

  it("refuses to delete approved requirements", async () => {
    const approved = requirementRow({ status: "approved", approvedBy: "owner-a" });
    const svc = makeRequirementsService({
      requirement: { findFirst: vi.fn().mockResolvedValue(approved) },
    });

    await expect(svc.delete("project-a", "req-1", "user-a")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("requirement links on test cases", () => {
  it("rejects manual test-case links to unapproved or cross-project requirement versions", async () => {
    const svc = new TestAssetsService(
      { requirementVersion: { findFirst: vi.fn().mockResolvedValue(null) } } as never,
      { record: vi.fn() } as never,
    );

    await expect(
      svc.createCase("project-a", "user-a", {
        title: "Checkout case",
        priority: "medium",
        requirementVersionId: "ver-x",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows manual test cases to link approved requirement versions in the same project", async () => {
    const created = {
      id: "case-1",
      projectId: "project-a",
      moduleId: null,
      title: "Checkout case",
      preconditions: null,
      priority: "medium",
      status: "draft",
      tags: [],
      notes: null,
      origin: "manual",
      aiRunId: null,
      requirementVersionId: "ver-1",
      createdBy: "user-a",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      steps: [],
    };
    const testCaseCreate = vi.fn().mockResolvedValue(created);
    const svc = new TestAssetsService(
      {
        requirementVersion: { findFirst: vi.fn().mockResolvedValue({ id: "ver-1" }) },
        testCase: { create: testCaseCreate },
      } as never,
      { record: vi.fn() } as never,
    );

    const dto = await svc.createCase("project-a", "user-a", {
      title: "Checkout case",
      priority: "medium",
      requirementVersionId: "ver-1",
    });

    expect(testCaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requirementVersionId: "ver-1" }) }),
    );
    expect(dto.requirementVersionId).toBe("ver-1");
  });
});

function makeAiService(prisma: Record<string, unknown>, assets: Record<string, unknown> = {}) {
  let seq = 0;
  return new AiOrchestrationService(
    prisma as never,
    {
      register: vi.fn(),
      nextSeq: vi.fn(() => ++seq),
      append: vi.fn(),
      release: vi.fn(),
      snapshot: vi.fn(() => []),
      subscribe: vi.fn(),
    } as never,
    assets as never,
    { record: vi.fn() } as never,
    { generateDrafts: vi.fn().mockResolvedValue({ cases: [{ title: "Checkout works", priority: "medium", steps: [{ order: 1, action: "Pay" }] }] }) } as never,
    { retrieveForGeneration: vi.fn().mockResolvedValue({ sources: [] }) } as never,
    { listAllowlist: vi.fn().mockResolvedValue([]) } as never,
    { invoke: vi.fn() } as never,
  );
}

describe("approved requirement AI linkage", () => {
  it("rejects unmanaged or unapproved requirement versions as generation input", async () => {
    const svc = makeAiService({ requirementVersion: { findFirst: vi.fn().mockResolvedValue(null) } });

    await expect(
      svc.startGeneration("user-a", { projectId: "project-a", requirementVersionId: "ver-x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses approved requirement content and records a managed requirement input", async () => {
    const finalRun = {
      id: "run-1",
      projectId: "project-a",
      kind: "test-generation",
      status: "awaiting-approval",
      providerId: null,
      requirementVersionId: "ver-1",
      createdBy: "user-a",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
      draftCases: [{ title: "Checkout works", priority: "medium", steps: [{ order: 1, action: "Pay" }] }],
      inputs: [
        {
          id: "input-1",
          runId: "run-1",
          kind: "managed-requirement",
          contentRef: "requirement-version:ver-1",
          filename: null,
          sizeBytes: null,
          checksum: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    };
    const aiRunInputCreate = vi.fn();
    const generateDrafts = vi.fn().mockResolvedValue({ cases: finalRun.draftCases });
    let seq = 0;
    const svc = new AiOrchestrationService(
      {
        requirementVersion: { findFirst: vi.fn().mockResolvedValue({ id: "ver-1", content: "Approved checkout content" }) },
        aiWorkflowRun: {
          create: vi.fn().mockResolvedValue({ ...finalRun, inputs: [] }),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue(finalRun),
        },
        aiRunInput: { create: aiRunInputCreate },
        workflowStageEvent: { create: vi.fn() },
        skillInstallation: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      { register: vi.fn(), nextSeq: vi.fn(() => ++seq), append: vi.fn(), release: vi.fn(), snapshot: vi.fn(() => []), subscribe: vi.fn() } as never,
      {} as never,
      { record: vi.fn() } as never,
      { generateDrafts } as never,
      { retrieveForGeneration: vi.fn().mockResolvedValue({ sources: [] }) } as never,
      { listAllowlist: vi.fn().mockResolvedValue([]) } as never,
      { invoke: vi.fn() } as never,
    );

    const dto = await svc.startGeneration("user-a", { projectId: "project-a", requirementVersionId: "ver-1" });

    expect(generateDrafts).toHaveBeenCalledWith(undefined, "Approved checkout content", "project-a");
    expect(aiRunInputCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "managed-requirement", contentRef: "requirement-version:ver-1" }) }),
    );
    expect(dto.requirementVersionId).toBe("ver-1");
  });

  it("passes the requirement version link when accepted drafts become test cases", async () => {
    const persistAcceptedDrafts = vi.fn().mockResolvedValue([]);
    const run = {
      id: "run-1",
      projectId: "project-a",
      kind: "test-generation",
      status: "awaiting-approval",
      providerId: null,
      requirementVersionId: "ver-1",
      createdBy: "user-a",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
      draftCases: [{ title: "Checkout works", priority: "medium", steps: [{ order: 1, action: "Pay" }] }],
      inputs: [],
    };
    const svc = makeAiService(
      {
        aiWorkflowRun: {
          findUnique: vi.fn().mockResolvedValue(run),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...run, status: "accepted", finishedAt: new Date("2026-01-01T00:01:00.000Z") }),
        },
        module: { findFirst: vi.fn().mockResolvedValue(undefined) },
        workflowStageEvent: { create: vi.fn() },
      },
      { persistAcceptedDrafts },
    );

    await svc.accept("user-a", "run-1", {});

    expect(persistAcceptedDrafts).toHaveBeenCalledWith(
      "project-a",
      "user-a",
      "run-1",
      expect.any(Array),
      undefined,
      "ver-1",
    );
  });
});
