import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ApiGlobalHeadersService } from "../src/modules/api-automation/api-global-headers.service";

function makeService(prisma: Record<string, unknown>) {
  return new ApiGlobalHeadersService(prisma as never, { record: vi.fn() } as never);
}

describe("api global headers", () => {
  it("rejects invalid header names", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "invalid header", value: "v" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.create("p", "u", { name: "", value: "v" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects oversized values", async () => {
    const svc = makeService({});
    await expect(
      svc.create("p", "u", { name: "X-Test", value: "x".repeat(2000) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("masks secret values in list DTO", async () => {
    const row = {
      id: "h-1",
      projectId: "p",
      name: "X-Api-Key",
      value: "secret-token",
      secret: true,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = makeService({
      apiGlobalHeader: { findMany: vi.fn().mockResolvedValue([row]) },
    });
    const result = await svc.list("p");
    expect(result[0]!.value).toBe("••••");
    expect(result[0]!.secret).toBe(true);
  });

  it("update 404 when header missing or cross-project", async () => {
    const svc = makeService({
      apiGlobalHeader: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.update("p", "h-x", "u", { value: "v" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("resolveForRun returns merged header bag", async () => {
    const svc = makeService({
      apiGlobalHeader: {
        findMany: vi.fn().mockResolvedValue([
          { name: "X-Default", value: "global" },
          { name: "Authorization", value: "Bearer abc" },
        ]),
      },
    });
    const result = await svc.resolveForRun("p");
    expect(result).toEqual({ "X-Default": "global", Authorization: "Bearer abc" });
  });
});
