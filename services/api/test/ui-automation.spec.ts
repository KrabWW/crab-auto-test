import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UiAutomationService } from "../src/modules/ui-automation/ui-automation.service";

function makeService(prisma: Record<string, unknown>) {
  return new UiAutomationService(prisma as never, { record: vi.fn() } as never);
}

describe("ui automation page objects", () => {
  it("create rejects empty name", async () => {
    const svc = makeService({});
    await expect(svc.createPageObject("p", "u", { name: "" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create persists and returns dto", async () => {
    const created = {
      id: "po-1",
      projectId: "p",
      name: "Login page",
      urlPattern: "/login",
      description: null,
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      locators: [],
      steps: [],
    };
    const svc = makeService({
      uiPageObject: { create: vi.fn().mockResolvedValue(created) },
    });
    const dto = await svc.createPageObject("p", "u", { name: "Login page", urlPattern: "/login" });
    expect(dto.id).toBe("po-1");
    expect(dto.urlPattern).toBe("/login");
  });

  it("get 404 for cross-project", async () => {
    const svc = makeService({
      uiPageObject: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.getPageObject("p", "po-x")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ui automation locators", () => {
  it("create rejects unknown strategy", async () => {
    const svc = makeService({
      uiPageObject: {
        findFirst: vi.fn().mockResolvedValue({ id: "po-1", projectId: "p", name: "P", urlPattern: null, description: null, createdBy: "u", createdAt: new Date(), updatedAt: new Date(), locators: [], steps: [] }),
      },
    });
    await expect(
      svc.createLocator("p", "po-1", "u", {
        name: "email",
        strategy: "magic" as never,
        value: "#email",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects empty value", async () => {
    const svc = makeService({
      uiPageObject: {
        findFirst: vi.fn().mockResolvedValue({ id: "po-1", projectId: "p", name: "P", urlPattern: null, description: null, createdBy: "u", createdAt: new Date(), updatedAt: new Date(), locators: [], steps: [] }),
      },
    });
    await expect(
      svc.createLocator("p", "po-1", "u", {
        name: "email",
        strategy: "css",
        value: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ui automation steps", () => {
  it("create rejects unknown action", async () => {
    const svc = makeService({
      uiPageObject: {
        findFirst: vi.fn().mockResolvedValue({ id: "po-1", projectId: "p", name: "P", urlPattern: null, description: null, createdBy: "u", createdAt: new Date(), updatedAt: new Date(), locators: [], steps: [] }),
      },
    });
    await expect(
      svc.createStep("p", "po-1", "u", {
        order: 1,
        action: "teleport" as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create rejects unknown locator reference", async () => {
    const svc = makeService({
      uiPageObject: {
        findFirst: vi.fn().mockResolvedValue({ id: "po-1", projectId: "p", name: "P", urlPattern: null, description: null, createdBy: "u", createdAt: new Date(), updatedAt: new Date(), locators: [], steps: [] }),
      },
      uiLocator: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      svc.createStep("p", "po-1", "u", {
        order: 1,
        action: "click",
        locatorId: "loc-missing",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
