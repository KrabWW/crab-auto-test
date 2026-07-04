import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateProjectApiKeyRequest,
  ProjectApiKeyCreatedDto,
  ProjectApiKeyDto,
} from "@crab/shared-types";

const KEY_PREFIX = "crab_";

@Injectable()
export class ProjectApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<ProjectApiKeyDto[]> {
    const rows = await this.prisma.projectApiKey.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    projectId: string,
    actorId: string,
    req: CreateProjectApiKeyRequest,
  ): Promise<ProjectApiKeyCreatedDto> {
    const name = req.name?.trim();
    if (!name) throw new BadRequestException("Key name is required");
    if (name.length > 60) throw new BadRequestException("Key name must be at most 60 characters");

    const plaintext = KEY_PREFIX + randomBytes(24).toString("hex");
    const keyHash = this.hash(plaintext);
    const keyPrefix = plaintext.slice(0, 12);

    let expiresAt: Date | null = null;
    if (req.expiresAt) {
      const parsed = new Date(req.expiresAt);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException("expiresAt must be a valid ISO date");
      }
      expiresAt = parsed;
    }

    const created = await this.prisma.projectApiKey.create({
      data: {
        projectId,
        name,
        keyHash,
        keyPrefix,
        scopes: req.scopes ?? [],
        expiresAt,
        createdBy: actorId,
      },
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "api-key.create",
      targetType: "project-api-key",
      targetId: created.id,
      outcome: "success",
      metadata: { name, keyPrefix },
    });

    return { ...this.toDto(created), plaintextKey: plaintext };
  }

  async revoke(projectId: string, keyId: string, actorId: string): Promise<ProjectApiKeyDto> {
    const row = await this.prisma.projectApiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (!row) throw new NotFoundException("API key not found");
    const updated = await this.prisma.projectApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-key.revoke",
      targetType: "project-api-key",
      targetId: keyId,
      outcome: "success",
    });
    return this.toDto(updated);
  }

  async delete(projectId: string, keyId: string, actorId: string): Promise<void> {
    const row = await this.prisma.projectApiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (!row) throw new NotFoundException("API key not found");
    await this.prisma.projectApiKey.delete({ where: { id: keyId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-key.delete",
      targetType: "project-api-key",
      targetId: keyId,
      outcome: "success",
    });
  }

  /**
   * Resolve an API key from the X-API-Key header. Returns the projectId if the
   * key is valid, non-expired, and non-revoked. Updates lastUsedAt as a side
   * effect.
   */
  async resolve(rawKey: string): Promise<{ projectId: string; keyId: string } | null> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
    const keyHash = this.hash(rawKey);
    const row = await this.prisma.projectApiKey.findFirst({
      where: { keyHash, revokedAt: null },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;
    await this.prisma.projectApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // best-effort
    });
    return { projectId: row.projectId, keyId: row.id };
  }

  private hash(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  private toDto(row: {
    id: string;
    projectId: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdBy: string;
    createdAt: Date;
  }): ProjectApiKeyDto {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
      ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
      ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
