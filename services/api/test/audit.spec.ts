import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../src/modules/audit/audit.service";

function makeService(prisma: Record<string, unknown>) {
  return new AuditService(prisma as never);
}

describe("audit query", () => {
  it("treats empty strings as no filter and clamps limit", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = makeService({ auditLog: { findMany } });
    await svc.query({ projectId: "", actorId: "", action: "", limit: "0" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        take: 100,
      }),
    );
  });

  it("caps the limit at 500", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = makeService({ auditLog: { findMany } });
    await svc.query({ limit: "9999" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });

  it("forwards non-empty filters", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = makeService({ auditLog: { findMany } });
    await svc.query({ projectId: "p1", actorId: "u1", action: "requirement.create" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "p1", actorId: "u1", action: "requirement.create" }),
      }),
    );
  });

  it("maps rows to AuditLogDto with undefined projectId when null", async () => {
    const row = {
      id: "log-1",
      actorId: "u1",
      projectId: null,
      action: "auth.login",
      targetType: "user",
      targetId: "u1",
      outcome: "success",
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const svc = makeService({ auditLog: { findMany: vi.fn().mockResolvedValue([row]) } });
    const result = await svc.query({});
    expect(result[0]!.projectId).toBeUndefined();
    expect(result[0]!.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
