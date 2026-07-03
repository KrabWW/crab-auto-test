import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ModelProvidersService } from "../src/modules/model-providers/model-providers.service";

function makeService(prisma: Record<string, unknown>, crypto: Record<string, unknown> = {}) {
  return new ModelProvidersService(
    prisma as never,
    { encrypt: vi.fn(), decrypt: vi.fn(() => "valid-secret") , ...crypto } as never,
    { record: vi.fn() } as never,
  );
}

describe("model provider project visibility", () => {
  it("rejects project-scoped listing when the caller is not a project member", async () => {
    const findMany = vi.fn();
    const svc = makeService({
      projectMember: { findUnique: vi.fn().mockResolvedValue(null) },
      modelProvider: { findMany },
    });

    await expect(svc.listForUser({ userId: "user-b" }, "project-a")).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects project-scoped provider validation before decrypting credentials for non-members", async () => {
    const decrypt = vi.fn();
    const svc = makeService(
      {
        projectMember: { findUnique: vi.fn().mockResolvedValue(null) },
        modelProvider: { findUnique: vi.fn().mockResolvedValue({ id: "provider-1", projectId: "project-a" }) },
      },
      { decrypt },
    );

    await expect(svc.validate("provider-1", "user-b")).rejects.toBeInstanceOf(ForbiddenException);
    expect(decrypt).not.toHaveBeenCalled();
  });
});
