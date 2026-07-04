import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RequirementDocumentsService } from "../src/modules/requirements/requirement-documents.service";

interface FakeMultipartFile {
  type: "file";
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}

function makeMultipartFile(overrides: Partial<FakeMultipartFile> = {}): FakeMultipartFile {
  return {
    type: "file",
    filename: overrides.filename ?? "spec.txt",
    mimetype: overrides.mimetype ?? "text/plain",
    toBuffer:
      overrides.toBuffer ??
      (() => Promise.resolve(Buffer.from("hello spec", "utf8"))),
  };
}

function makeService(prisma: Record<string, unknown>) {
  return new RequirementDocumentsService(prisma as never, { record: vi.fn() } as never);
}

describe("requirement documents upload validation", () => {
  it("rejects unsupported file extensions", async () => {
    const svc = makeService({});
    const file = makeMultipartFile({ filename: "spec.xlsx", mimetype: "application/vnd.ms-excel" });
    await expect(svc.upload("project-a", "user-a", file as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects empty files", async () => {
    const svc = makeService({});
    const file = makeMultipartFile({ toBuffer: () => Promise.resolve(Buffer.alloc(0)) });
    await expect(svc.upload("project-a", "user-a", file as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects files whose MIME type contradicts the extension", async () => {
    const svc = makeService({});
    const file = makeMultipartFile({ filename: "spec.pdf", mimetype: "text/plain" });
    await expect(svc.upload("project-a", "user-a", file as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("requirement documents project scoping", () => {
  it("returns NotFound when document belongs to a different project", async () => {
    const svc = makeService({
      requirementDocument: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.get("project-a", "doc-x")).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.delete("project-a", "doc-x", "user-a")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("extract throws NotFound when document is missing", async () => {
    const svc = makeService({
      requirementDocument: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.extract("project-a", "doc-x", "user-a")).rejects.toBeInstanceOf(NotFoundException);
  });
});
