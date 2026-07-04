import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProjectApiKeysService } from "../src/modules/projects/project-api-keys.service";

function makeService(prisma: Record<string, unknown>) {
  return new ProjectApiKeysService(prisma as never, { record: vi.fn() } as never);
}

describe("project api keys", () => {
  it("create rejects empty name", async () => {
    const svc = makeService({});
    await expect(svc.create("p", "u", { name: "" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects oversized name", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "x".repeat(61) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create returns plaintext key only once", async () => {
    const created = {
      id: "k-1",
      projectId: "p",
      name: "CI runner",
      keyPrefix: "crab_abcdef",
      scopes: [],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdBy: "u",
      createdAt: new Date(),
    };
    const svc = makeService({
      projectApiKey: { create: vi.fn().mockResolvedValue(created) },
    });
    const result = await svc.create("p", "u", { name: "CI runner" });
    expect(result.plaintextKey).toMatch(/^crab_[0-9a-f]{48}$/);
    expect(result.keyPrefix).toMatch(/^crab_/);
  });

  it("resolve returns null for wrong prefix", async () => {
    const svc = makeService({});
    expect(await svc.resolve("wrong_token")).toBeNull();
    expect(await svc.resolve("")).toBeNull();
  });

  it("resolve returns null when key not found", async () => {
    const svc = makeService({
      projectApiKey: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    expect(await svc.resolve("crab_deadbeef")).toBeNull();
  });

  it("resolve returns null when key is expired", async () => {
    const svc = makeService({
      projectApiKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: "k-1",
          projectId: "p",
          keyHash: "h",
          revokedAt: null,
          expiresAt: new Date("2020-01-01"),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    expect(await svc.resolve("crab_expiredkey1234567890123456789012")).toBeNull();
  });

  it("revoke 404 when key missing", async () => {
    const svc = makeService({
      projectApiKey: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.revoke("p", "k-x", "u")).rejects.toBeInstanceOf(NotFoundException);
  });
});
