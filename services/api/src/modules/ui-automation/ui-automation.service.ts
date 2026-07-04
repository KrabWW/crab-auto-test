import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateUiLocatorRequest,
  CreateUiPageObjectRequest,
  CreateUiPageStepRequest,
  UiLocatorDto,
  UiLocatorStrategy,
  UiPageObjectDto,
  UiPageStepAction,
  UiPageStepDto,
  UpdateUiPageObjectRequest,
} from "@crab/shared-types";

const STRATEGIES = new Set<UiLocatorStrategy>(["css", "xpath", "id", "data-testid", "text", "role"]);
const ACTIONS = new Set<UiPageStepAction>([
  "navigate",
  "click",
  "fill",
  "select",
  "assert",
  "wait",
  "screenshot",
]);

@Injectable()
export class UiAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Page objects ──────────────────────────────────────────────────────────

  async listPageObjects(projectId: string): Promise<UiPageObjectDto[]> {
    const rows = await this.prisma.uiPageObject.findMany({
      where: { projectId },
      include: {
        locators: { orderBy: { name: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toPageObjectDto(row));
  }

  async getPageObject(projectId: string, id: string): Promise<UiPageObjectDto> {
    const row = await this.prisma.uiPageObject.findFirst({
      where: { id, projectId },
      include: {
        locators: { orderBy: { name: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    if (!row) throw new NotFoundException("Page object not found");
    return this.toPageObjectDto(row);
  }

  async createPageObject(
    projectId: string,
    actorId: string,
    req: CreateUiPageObjectRequest,
  ): Promise<UiPageObjectDto> {
    const name = req.name?.trim();
    if (!name) throw new BadRequestException("Page object name is required");
    const created = await this.prisma.uiPageObject.create({
      data: {
        projectId,
        name,
        urlPattern: req.urlPattern?.trim() || null,
        description: req.description?.trim() || null,
        createdBy: actorId,
      },
      include: {
        locators: { orderBy: { name: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "ui-page-object.create",
      targetType: "ui-page-object",
      targetId: created.id,
      outcome: "success",
      metadata: { name },
    });
    return this.toPageObjectDto(created);
  }

  async updatePageObject(
    projectId: string,
    id: string,
    actorId: string,
    req: UpdateUiPageObjectRequest,
  ): Promise<UiPageObjectDto> {
    await this.getPageObject(projectId, id);
    const updated = await this.prisma.uiPageObject.update({
      where: { id },
      data: {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(req.urlPattern !== undefined ? { urlPattern: req.urlPattern } : {}),
        ...(req.description !== undefined ? { description: req.description } : {}),
      },
      include: {
        locators: { orderBy: { name: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    return this.toPageObjectDto(updated);
  }

  async deletePageObject(projectId: string, id: string, actorId: string): Promise<void> {
    await this.getPageObject(projectId, id);
    await this.prisma.uiPageObject.delete({ where: { id } });
    await this.audit.record({
      actorId,
      projectId,
      action: "ui-page-object.delete",
      targetType: "ui-page-object",
      targetId: id,
      outcome: "success",
    });
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  async createLocator(
    projectId: string,
    pageObjectId: string,
    actorId: string,
    req: CreateUiLocatorRequest,
  ): Promise<UiLocatorDto> {
    await this.getPageObject(projectId, pageObjectId);
    const name = req.name?.trim();
    if (!name) throw new BadRequestException("Locator name is required");
    if (!STRATEGIES.has(req.strategy)) {
      throw new BadRequestException(`Unsupported locator strategy: ${req.strategy}`);
    }
    if (!req.value?.trim()) throw new BadRequestException("Locator value is required");
    const created = await this.prisma.uiLocator.create({
      data: {
        pageObjectId,
        projectId,
        name,
        strategy: req.strategy,
        value: req.value.trim(),
        description: req.description?.trim() || null,
      },
    });
    return this.toLocatorDto(created);
  }

  async deleteLocator(projectId: string, locatorId: string): Promise<void> {
    const row = await this.prisma.uiLocator.findFirst({
      where: { id: locatorId, projectId },
    });
    if (!row) throw new NotFoundException("Locator not found");
    await this.prisma.uiLocator.delete({ where: { id: locatorId } });
  }

  // ── Page steps ────────────────────────────────────────────────────────────

  async createStep(
    projectId: string,
    pageObjectId: string,
    actorId: string,
    req: CreateUiPageStepRequest,
  ): Promise<UiPageStepDto> {
    await this.getPageObject(projectId, pageObjectId);
    if (!ACTIONS.has(req.action)) {
      throw new BadRequestException(`Unsupported step action: ${req.action}`);
    }
    if (req.locatorId) {
      const locator = await this.prisma.uiLocator.findFirst({
        where: { id: req.locatorId, pageObjectId },
      });
      if (!locator) throw new BadRequestException("Step references unknown locator");
    }
    const created = await this.prisma.uiPageStep.create({
      data: {
        pageObjectId,
        projectId,
        order: req.order,
        action: req.action,
        locatorId: req.locatorId ?? null,
        value: req.value ?? null,
        description: req.description?.trim() || null,
      },
    });
    return this.toStepDto(created);
  }

  async deleteStep(projectId: string, stepId: string): Promise<void> {
    const row = await this.prisma.uiPageStep.findFirst({
      where: { id: stepId, projectId },
    });
    if (!row) throw new NotFoundException("Page step not found");
    await this.prisma.uiPageStep.delete({ where: { id: stepId } });
  }

  // ── DTO mappers ───────────────────────────────────────────────────────────

  private toPageObjectDto(row: {
    id: string;
    projectId: string;
    name: string;
    urlPattern: string | null;
    description: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    locators: Array<{
      id: string;
      pageObjectId: string;
      projectId: string;
      name: string;
      strategy: string;
      value: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    steps: Array<{
      id: string;
      pageObjectId: string;
      projectId: string;
      order: number;
      action: string;
      locatorId: string | null;
      value: string | null;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): UiPageObjectDto {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      ...(row.urlPattern ? { urlPattern: row.urlPattern } : {}),
      ...(row.description ? { description: row.description } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      locators: row.locators.map((l) => this.toLocatorDto(l)),
      steps: row.steps.map((s) => this.toStepDto(s)),
    };
  }

  private toLocatorDto(row: {
    id: string;
    pageObjectId: string;
    projectId: string;
    name: string;
    strategy: string;
    value: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UiLocatorDto {
    return {
      id: row.id,
      pageObjectId: row.pageObjectId,
      projectId: row.projectId,
      name: row.name,
      strategy: row.strategy as UiLocatorStrategy,
      value: row.value,
      ...(row.description ? { description: row.description } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toStepDto(row: {
    id: string;
    pageObjectId: string;
    projectId: string;
    order: number;
    action: string;
    locatorId: string | null;
    value: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UiPageStepDto {
    return {
      id: row.id,
      pageObjectId: row.pageObjectId,
      projectId: row.projectId,
      order: row.order,
      action: row.action as UiPageStepAction,
      ...(row.locatorId ? { locatorId: row.locatorId } : {}),
      ...(row.value ? { value: row.value } : {}),
      ...(row.description ? { description: row.description } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
