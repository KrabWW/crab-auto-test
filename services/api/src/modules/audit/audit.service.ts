import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { redact } from "../../common/redact";
import type { AuditLogDto, AuditOutcome, AuditQuery } from "@crab/shared-types";

/** platform-foundation.4: append-only audit log. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorId: string;
    projectId?: string;
    action: string;
    targetType: string;
    targetId: string;
    outcome: AuditOutcome;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        projectId: input.projectId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        outcome: input.outcome,
        metadata: redact(input.metadata) as object,
      },
    });
  }

  async query(q: AuditQuery): Promise<AuditLogDto[]> {
    const projectId = typeof q.projectId === "string" && q.projectId ? q.projectId : undefined;
    const actorId = typeof q.actorId === "string" && q.actorId ? q.actorId : undefined;
    const action = typeof q.action === "string" && q.action ? q.action : undefined;
    const parsedLimit = Number(q.limit);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(actorId ? { actorId } : {}),
        ...(action ? { action } : {}),
        ...(q.from
          ? { createdAt: { gte: new Date(q.from), ...(q.to ? { lte: new Date(q.to) } : {}) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((r): AuditLogDto => ({
      id: r.id,
      actorId: r.actorId,
      projectId: r.projectId ?? undefined,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      outcome: r.outcome,
      metadata: r.metadata as Record<string, unknown> | undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
