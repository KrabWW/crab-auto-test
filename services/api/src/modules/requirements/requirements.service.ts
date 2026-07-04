import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateRequirementRequest,
  RequirementDto,
  RequirementReviewEventDto,
  RequirementStatus,
  RequirementTransitionAction,
  RequirementVersionDto,
  UpdateRequirementRequest,
} from "@crab/shared-types";

const STATUSES = new Set<RequirementStatus>(["draft", "in-review", "approved", "rejected", "archived"]);

/** States that allow inline edits without version bump. */
const EDITABLE_STATES: ReadonlySet<RequirementStatus> = new Set(["draft", "in-review", "rejected"]);
/** States that can be deleted. Terminal or pre-review states only. */
const DELETABLE_STATES: ReadonlySet<RequirementStatus> = new Set(["draft", "rejected", "archived"]);

interface RequirementRow {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: string;
  version: number;
  createdBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  archivedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: RequirementVersionRow[];
  events: RequirementEventRow[];
}

interface RequirementVersionRow {
  id: string;
  requirementId: string;
  projectId: string;
  version: number;
  title: string;
  content: string;
  status: string;
  createdBy: string;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
  createdAt: Date;
}

interface RequirementEventRow {
  id: string;
  requirementId: string;
  projectId: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  actorId: string;
  createdAt: Date;
}

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string): Promise<RequirementDto[]> {
    const rows = await this.prisma.requirement.findMany({
      where: { projectId },
      include: this.includeDetails,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.toDto(row));
  }

  async approvedVersions(projectId: string): Promise<RequirementVersionDto[]> {
    const rows = await this.prisma.requirementVersion.findMany({
      where: { projectId, status: "approved" },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });
    return rows.map((row) => this.toVersionDto(row));
  }

  async get(projectId: string, requirementId: string): Promise<RequirementDto> {
    return this.toDto(await this.findRequirement(projectId, requirementId));
  }

  async create(projectId: string, actorId: string, req: CreateRequirementRequest): Promise<RequirementDto> {
    const title = req.title.trim();
    const content = req.content.trim();
    if (!title) throw new BadRequestException("Requirement title is required");
    if (!content) throw new BadRequestException("Requirement content is required");

    const created = await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.requirement.create({
        data: { projectId, title, content, status: "draft", version: 1, createdBy: actorId },
      });
      await tx.requirementVersion.create({
        data: {
          requirementId: requirement.id,
          projectId,
          version: 1,
          title,
          content,
          status: "draft",
          createdBy: actorId,
        },
      });
      await tx.requirementReviewEvent.create({
        data: {
          requirementId: requirement.id,
          projectId,
          fromStatus: null,
          toStatus: "draft",
          action: "create",
          actorId,
        },
      });
      return tx.requirement.findUniqueOrThrow({ where: { id: requirement.id }, include: this.includeDetails });
    });
    await this.recordAudit(actorId, projectId, "requirement.create", created.id, { status: "draft", version: 1 });
    return this.toDto(created);
  }

  async update(
    projectId: string,
    requirementId: string,
    actorId: string,
    req: UpdateRequirementRequest,
  ): Promise<RequirementDto> {
    const existing = await this.findRequirement(projectId, requirementId);
    const title = req.title?.trim() || existing.title;
    const content = req.content?.trim() || existing.content;
    if (!title) throw new BadRequestException("Requirement title is required");
    if (!content) throw new BadRequestException("Requirement content is required");

    const changed = title !== existing.title || content !== existing.content;
    if (!changed) return this.toDto(existing);

    const existingStatus = toRequirementStatus(existing.status);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (existingStatus === "approved") {
        // Editing an approved requirement opens a new draft version (version+1).
        const nextVersion = existing.version + 1;
        await tx.requirement.update({
          where: { id: requirementId },
          data: {
            title,
            content,
            version: nextVersion,
            status: "draft",
            reviewedBy: null,
            approvedBy: null,
            rejectedBy: null,
            archivedBy: null,
          },
        });
        await tx.requirementVersion.create({
          data: {
            requirementId,
            projectId,
            version: nextVersion,
            title,
            content,
            status: "draft",
            createdBy: actorId,
          },
        });
        await tx.requirementReviewEvent.create({
          data: {
            requirementId,
            projectId,
            fromStatus: "approved",
            toStatus: "draft",
            action: "update",
            actorId,
          },
        });
      } else if (existingStatus === "in-review" || existingStatus === "rejected") {
        // Editing during review or after rejection returns the current version to draft.
        await tx.requirement.update({
          where: { id: requirementId },
          data: {
            title,
            content,
            status: "draft",
            reviewedBy: null,
            approvedBy: null,
            rejectedBy: null,
          },
        });
        await tx.requirementVersion.update({
          where: { requirementId_version: { requirementId, version: existing.version } },
          data: {
            title,
            content,
            status: "draft",
            reviewedAt: null,
            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
          },
        });
        await tx.requirementReviewEvent.create({
          data: {
            requirementId,
            projectId,
            fromStatus: existingStatus,
            toStatus: "draft",
            action: "update",
            actorId,
          },
        });
      } else if (EDITABLE_STATES.has(existingStatus)) {
        // draft (or already-draft) — simple in-place edit, no event recorded.
        await tx.requirement.update({
          where: { id: requirementId },
          data: { title, content },
        });
        await tx.requirementVersion.update({
          where: { requirementId_version: { requirementId, version: existing.version } },
          data: { title, content },
        });
      } else {
        // approved/archived handled above; this branch is unreachable for archived
        // because archived requirements are not editable. Defensive guard:
        throw new BadRequestException(`Cannot edit requirement in status "${existingStatus}"`);
      }
      return tx.requirement.findUniqueOrThrow({ where: { id: requirementId }, include: this.includeDetails });
    });
    await this.recordAudit(actorId, projectId, "requirement.update", requirementId, {
      fromStatus: existing.status,
      toStatus: updated.status,
      version: updated.version,
    });
    return this.toDto(updated);
  }

  async submitReview(projectId: string, requirementId: string, actorId: string): Promise<RequirementDto> {
    const existing = await this.findRequirement(projectId, requirementId);
    if (existing.status !== "draft") throw new BadRequestException("Only draft requirements can be reviewed");
    return this.transition(projectId, requirementId, actorId, "submit-review", "in-review");
  }

  async approve(projectId: string, requirementId: string, actorId: string): Promise<RequirementDto> {
    const role = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actorId } },
    });
    if (role?.role !== "owner") throw new ForbiddenException("Only project owners can approve requirements");
    const existing = await this.findRequirement(projectId, requirementId);
    if (existing.status !== "in-review") throw new BadRequestException("Only in-review requirements can be approved");
    return this.transition(projectId, requirementId, actorId, "approve", "approved");
  }

  async reject(projectId: string, requirementId: string, actorId: string): Promise<RequirementDto> {
    const role = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actorId } },
    });
    if (role?.role !== "owner") throw new ForbiddenException("Only project owners can reject requirements");
    const existing = await this.findRequirement(projectId, requirementId);
    if (existing.status !== "in-review") throw new BadRequestException("Only in-review requirements can be rejected");
    return this.transition(projectId, requirementId, actorId, "reject", "rejected");
  }

  async archive(projectId: string, requirementId: string, actorId: string): Promise<RequirementDto> {
    const existing = await this.findRequirement(projectId, requirementId);
    if (existing.status === "archived") throw new BadRequestException("Requirement is already archived");
    return this.transition(projectId, requirementId, actorId, "archive", "archived");
  }

  async delete(projectId: string, requirementId: string, actorId: string): Promise<void> {
    const existing = await this.findRequirement(projectId, requirementId);
    const status = toRequirementStatus(existing.status);
    if (!DELETABLE_STATES.has(status)) {
      throw new BadRequestException(`Cannot delete requirement in status "${status}"`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.requirementReviewEvent.deleteMany({ where: { requirementId } });
      await tx.requirementVersion.deleteMany({ where: { requirementId } });
      await tx.requirement.delete({ where: { id: requirementId } });
    });
    await this.recordAudit(actorId, projectId, "requirement.delete", requirementId, {
      fromStatus: existing.status,
      version: existing.version,
    });
  }

  private async transition(
    projectId: string,
    requirementId: string,
    actorId: string,
    action: RequirementTransitionAction,
    toStatus: RequirementStatus,
  ): Promise<RequirementDto> {
    const existing = await this.findRequirement(projectId, requirementId);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requirement.update({
        where: { id: requirementId },
        data: {
          status: toStatus,
          ...(toStatus === "in-review" ? { reviewedBy: actorId } : {}),
          ...(toStatus === "approved" ? { approvedBy: actorId } : {}),
          ...(toStatus === "rejected" ? { rejectedBy: actorId } : {}),
          ...(toStatus === "archived" ? { archivedBy: actorId } : {}),
        },
      });
      await tx.requirementVersion.update({
        where: { requirementId_version: { requirementId, version: existing.version } },
        data: {
          status: toStatus,
          ...(toStatus === "in-review" ? { reviewedAt: now } : {}),
          ...(toStatus === "approved" ? { approvedAt: now, approvedBy: actorId } : {}),
          ...(toStatus === "rejected" ? { rejectedAt: now, rejectedBy: actorId } : {}),
          ...(toStatus === "archived" ? { archivedAt: now, archivedBy: actorId } : {}),
        },
      });
      await tx.requirementReviewEvent.create({
        data: {
          requirementId,
          projectId,
          fromStatus: existing.status,
          toStatus,
          action,
          actorId,
        },
      });
      return tx.requirement.findUniqueOrThrow({ where: { id: requirementId }, include: this.includeDetails });
    });
    await this.recordAudit(actorId, projectId, `requirement.${action}`, requirementId, {
      fromStatus: existing.status,
      toStatus,
      version: existing.version,
    });
    return this.toDto(updated);
  }

  private readonly includeDetails = {
    versions: { orderBy: { version: "desc" as const } },
    events: { orderBy: { createdAt: "desc" as const } },
  };

  private async findRequirement(projectId: string, requirementId: string): Promise<RequirementRow> {
    const row = await this.prisma.requirement.findFirst({
      where: { id: requirementId, projectId },
      include: this.includeDetails,
    });
    if (!row) throw new NotFoundException("Requirement not found");
    return row;
  }

  private async recordAudit(
    actorId: string,
    projectId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.audit.record({
      actorId,
      projectId,
      action,
      targetType: "requirement",
      targetId,
      outcome: "success",
      metadata,
    });
  }

  private toDto(row: RequirementRow): RequirementDto {
    const status = toRequirementStatus(row.status);
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      content: row.content,
      status,
      version: row.version,
      createdBy: row.createdBy,
      reviewedBy: row.reviewedBy ?? undefined,
      approvedBy: row.approvedBy ?? undefined,
      rejectedBy: row.rejectedBy ?? undefined,
      archivedBy: row.archivedBy ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      versions: row.versions.map((version) => this.toVersionDto(version)),
      reviewEvents: row.events.map((event) => this.toEventDto(event)),
    };
  }

  private toVersionDto(row: RequirementVersionRow): RequirementVersionDto {
    return {
      id: row.id,
      requirementId: row.requirementId,
      projectId: row.projectId,
      version: row.version,
      title: row.title,
      content: row.content,
      status: toRequirementStatus(row.status),
      createdBy: row.createdBy,
      reviewedAt: row.reviewedAt?.toISOString(),
      approvedAt: row.approvedAt?.toISOString(),
      approvedBy: row.approvedBy ?? undefined,
      rejectedAt: row.rejectedAt?.toISOString(),
      rejectedBy: row.rejectedBy ?? undefined,
      archivedAt: row.archivedAt?.toISOString(),
      archivedBy: row.archivedBy ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toEventDto(row: RequirementEventRow): RequirementReviewEventDto {
    return {
      id: row.id,
      requirementId: row.requirementId,
      projectId: row.projectId,
      fromStatus: row.fromStatus ? toRequirementStatus(row.fromStatus) : undefined,
      toStatus: toRequirementStatus(row.toStatus),
      action: row.action as RequirementTransitionAction,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function toRequirementStatus(value: string): RequirementStatus {
  if (!STATUSES.has(value as RequirementStatus)) throw new BadRequestException(`Unsupported requirement status: ${value}`);
  return value as RequirementStatus;
}
