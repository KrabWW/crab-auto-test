import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  ApiGlobalHeaderDto,
  CreateApiGlobalHeaderRequest,
  UpdateApiGlobalHeaderRequest,
} from "@crab/shared-types";

interface GlobalHeaderRow {
  id: string;
  projectId: string;
  name: string;
  value: string;
  secret: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

@Injectable()
export class ApiGlobalHeadersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<ApiGlobalHeaderDto[]> {
    const rows = await this.prisma.apiGlobalHeader.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => this.toDto(row as unknown as GlobalHeaderRow));
  }

  async create(
    projectId: string,
    actorId: string,
    req: CreateApiGlobalHeaderRequest,
  ): Promise<ApiGlobalHeaderDto> {
    const name = (req.name ?? "").trim();
    const value = req.value ?? "";
    if (!NAME_PATTERN.test(name)) {
      throw new BadRequestException(
        "Header name must be 1-64 letters, digits, or hyphens (HTTP header convention).",
      );
    }
    if (value.length > 1024) {
      throw new BadRequestException("Header value must be at most 1024 characters.");
    }
    const secret = Boolean(req.secret);

    const created = await this.prisma.apiGlobalHeader.create({
      data: {
        projectId,
        name,
        value,
        secret,
        createdBy: actorId,
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-global-header.create",
      targetType: "api-global-header",
      targetId: created.id,
      outcome: "success",
      metadata: { name, secret },
    });
    return this.toDto(created as unknown as GlobalHeaderRow);
  }

  async update(
    projectId: string,
    headerId: string,
    actorId: string,
    req: UpdateApiGlobalHeaderRequest,
  ): Promise<ApiGlobalHeaderDto> {
    await this.findHeader(projectId, headerId);
    if (req.name !== undefined && !NAME_PATTERN.test(req.name.trim())) {
      throw new BadRequestException("Header name must match HTTP header convention.");
    }
    if (req.value !== undefined && req.value.length > 1024) {
      throw new BadRequestException("Header value must be at most 1024 characters.");
    }
    const updated = await this.prisma.apiGlobalHeader.update({
      where: { id: headerId },
      data: {
        ...(req.name !== undefined ? { name: req.name.trim() } : {}),
        ...(req.value !== undefined ? { value: req.value } : {}),
        ...(req.secret !== undefined ? { secret: req.secret } : {}),
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-global-header.update",
      targetType: "api-global-header",
      targetId: headerId,
      outcome: "success",
    });
    return this.toDto(updated as unknown as GlobalHeaderRow);
  }

  async delete(projectId: string, headerId: string, actorId: string): Promise<void> {
    await this.findHeader(projectId, headerId);
    await this.prisma.apiGlobalHeader.delete({ where: { id: headerId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-global-header.delete",
      targetType: "api-global-header",
      targetId: headerId,
      outcome: "success",
    });
  }

  /**
   * Returns the merged header bag for a project's case execution. Caller passes
   * the case's own headers; global headers provide defaults that the case
   * overrides. Secret values are returned as the raw value here because the
   * request builder is the only consumer and redacts them later in snapshots.
   */
  async resolveForRun(projectId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.apiGlobalHeader.findMany({
      where: { projectId },
      select: { name: true, value: true },
    });
    const out: Record<string, string> = {};
    for (const row of rows) {
      out[row.name] = row.value;
    }
    return out;
  }

  private async findHeader(projectId: string, headerId: string): Promise<GlobalHeaderRow> {
    const row = await this.prisma.apiGlobalHeader.findFirst({
      where: { id: headerId, projectId },
    });
    if (!row) throw new NotFoundException("Global header not found");
    return row as unknown as GlobalHeaderRow;
  }

  private toDto(row: GlobalHeaderRow): ApiGlobalHeaderDto {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      value: row.secret ? "••••" : row.value,
      secret: row.secret,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
