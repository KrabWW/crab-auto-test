import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { createHash } from "node:crypto";
import type {
  SkillDto,
  SkillInstallationDto,
  SkillInvocationDto,
  SkillPackageManifestDto,
} from "@crab/shared-types";

/**
 * skills-store.1–5: package validation, install/update/disable/uninstall,
 * rollback, permission review, invocation audit.
 *
 * §11 a2: simple roles only — permission approval is owner/member (no new role).
 * skills-store.5: failed validation keeps the current version (no half-state).
 *
 * A Skill package is a JSON manifest (name/version/description/author/
 * compatibility/permissions/entryPoints/checksum). The checksum is validated
 * BEFORE any install side-effect; on mismatch the install is blocked and the
 * current installation is untouched.
 */
export type SkillPackageManifest = SkillPackageManifestDto;

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * skills-store.1: validate package metadata + checksum BEFORE installable.
   * Returns the validated manifest or throws (caller must not install on throw).
   */
  validatePackage(manifest: SkillPackageManifest): { valid: boolean; computedChecksum: string; error?: string } {
    const required = ["name", "version", "description", "author", "checksum", "source"];
    for (const k of required) {
      if (!manifest[k as keyof SkillPackageManifest]) {
        return { valid: false, computedChecksum: "", error: `missing field: ${k}` };
      }
    }
    const computed = createHash("sha256")
      .update(manifest.payload ?? `${manifest.name}@${manifest.version}`)
      .digest("hex");
    if (computed !== manifest.checksum) {
      return { valid: false, computedChecksum: computed, error: "checksum mismatch" };
    }
    return { valid: true, computedChecksum: computed };
  }

  /**
   * skills-store.2: install a validated skill package.
   * skills-store.5: on validation failure, block install AND keep current
   * version (no half-state). The SkillInstallation row is only created on
   * success; a pre-existing installation is never mutated on a failed install.
   */
  async install(
    projectId: string,
    actorId: string,
    manifest: SkillPackageManifest,
  ): Promise<SkillInstallationDto> {
    const check = this.validatePackage(manifest);
    if (!check.valid) {
      await this.audit.record({
        actorId,
        projectId,
        action: "skill.install.validate-failed",
        targetType: "skill",
        targetId: `${manifest.name}@${manifest.version}`,
        outcome: "failure",
        metadata: { error: check.error },
      });
      throw new BadRequestException(`skill validation failed: ${check.error}`);
    }

    const skill = await this.prisma.skill.upsert({
      where: { name_version: { name: manifest.name, version: manifest.version } },
      create: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        compatibility: manifest.compatibility as object,
        permissions: manifest.permissions as object,
        entryPoints: manifest.entryPoints as object,
        checksum: manifest.checksum,
        source: manifest.source,
        validationStatus: "valid",
      },
      update: {
        description: manifest.description,
        author: manifest.author,
        compatibility: manifest.compatibility as object,
        permissions: manifest.permissions as object,
        entryPoints: manifest.entryPoints as object,
        checksum: manifest.checksum,
        source: manifest.source,
        validationStatus: "valid",
      },
    });

    const previous = await this.prisma.skillInstallation.findFirst({
      where: { projectId, skill: { name: manifest.name } },
      orderBy: { createdAt: "desc" },
    });

    const installation = await this.prisma.skillInstallation.create({
      data: {
        projectId,
        skillId: skill.id,
        state: "installed",
        previousVersionId: previous?.skillId,
        installedBy: actorId,
        installedChecksum: manifest.checksum,
      },
    });

    await this.audit.record({
      actorId,
      projectId,
      action: "skill.install",
      targetType: "skill-installation",
      targetId: installation.id,
      outcome: "success",
      metadata: { name: manifest.name, version: manifest.version, previousVersion: previous?.skillId },
    });
    return this.getInstallationDto(projectId, installation.id);
  }

  /** skills-store.3: explicit permission review + activation approval. */
  async approvePermissions(
    projectId: string,
    installationId: string,
    actorId: string,
    permissions: Record<string, unknown>,
  ): Promise<SkillInstallationDto> {
    const inst = await this.findProjectInstallation(projectId, installationId);
    await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { activatedPermissions: permissions as object },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "skill.permissions.approve",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
    });
    return this.getInstallationDto(projectId, inst.id);
  }

  async listInstallations(projectId: string): Promise<SkillInstallationDto[]> {
    const rows = await this.prisma.skillInstallation.findMany({
      where: { projectId },
      include: this.installationInclude(),
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toInstallationDto(row));
  }

  async listInvocations(projectId: string, installationId: string): Promise<SkillInvocationDto[]> {
    await this.findProjectInstallation(projectId, installationId);
    const rows = await this.prisma.skillInvocation.findMany({
      where: { installationId },
      orderBy: { invokedAt: "desc" },
      take: 50,
    });
    return rows.map((row) => this.toInvocationDto(row));
  }

  async getInstallation(projectId: string, installationId: string): Promise<SkillInstallationDto> {
    return this.getInstallationDto(projectId, installationId);
  }

  async enable(projectId: string, installationId: string, actorId: string): Promise<SkillInstallationDto> {
    const inst = await this.findProjectInstallation(projectId, installationId);
    await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { state: "installed" },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "skill.enable",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
    });
    return this.getInstallationDto(projectId, inst.id);
  }

  async disable(projectId: string, installationId: string, actorId: string): Promise<SkillInstallationDto> {
    const inst = await this.findProjectInstallation(projectId, installationId);
    await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { state: "disabled" },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "skill.disable",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
    });
    return this.getInstallationDto(projectId, inst.id);
  }

  async uninstall(projectId: string, installationId: string, actorId: string): Promise<SkillInstallationDto> {
    const inst = await this.findProjectInstallation(projectId, installationId);
    await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { state: "uninstalled" },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "skill.uninstall",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
    });
    return this.getInstallationDto(projectId, inst.id);
  }

  /**
   * skills-store.5: rollback to previous compatible version.
   * If the previous version is missing/incompatible, keep the current version
   * active and report the failure (no half-state).
   */
  async rollback(projectId: string, installationId: string, actorId: string): Promise<SkillInstallationDto> {
    const inst = await this.findProjectInstallation(projectId, installationId);
    if (!inst.previousVersionId) {
      throw new BadRequestException("no previous version to roll back to");
    }
    const previousSkill = await this.prisma.skill.findUnique({
      where: { id: inst.previousVersionId },
    });
    if (!previousSkill || previousSkill.validationStatus !== "valid") {
      await this.audit.record({
        actorId,
        projectId,
        action: "skill.rollback.failed",
        targetType: "skill-installation",
        targetId: installationId,
        outcome: "failure",
        metadata: { reason: "previous version invalid or missing" },
      });
      throw new BadRequestException("previous version invalid or missing; current version kept active");
    }
    await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { skillId: previousSkill.id, installedChecksum: previousSkill.checksum },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "skill.rollback",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
      metadata: { toVersion: previousSkill.version },
    });
    return this.getInstallationDto(projectId, installationId);
  }

  private installationInclude() {
    return {
      skill: true,
      _count: { select: { invocations: true } },
      invocations: { orderBy: { invokedAt: "desc" as const }, take: 5 },
    };
  }

  private async getInstallationDto(projectId: string, installationId: string): Promise<SkillInstallationDto> {
    const row = await this.prisma.skillInstallation.findFirst({
      where: { id: installationId, projectId },
      include: this.installationInclude(),
    });
    if (!row) throw new NotFoundException("Installation not found");
    return this.toInstallationDto(row);
  }

  private async findProjectInstallation(projectId: string, installationId: string) {
    const inst = await this.prisma.skillInstallation.findFirst({
      where: { id: installationId, projectId },
    });
    if (!inst) throw new NotFoundException("Installation not found");
    return inst;
  }

  private toInstallationDto(row: {
    id: string;
    projectId: string | null;
    state: string;
    activatedPermissions: unknown;
    previousVersionId: string | null;
    installedBy: string;
    installedChecksum: string;
    createdAt: Date;
    updatedAt: Date;
    skill: Parameters<SkillsService["toSkillDto"]>[0];
    _count?: { invocations?: number };
    invocations?: Array<Parameters<SkillsService["toInvocationDto"]>[0]>;
  }): SkillInstallationDto {
    return {
      id: row.id,
      projectId: row.projectId ?? undefined,
      state: row.state as SkillInstallationDto["state"],
      activatedPermissions: asRecord(row.activatedPermissions),
      previousVersionId: row.previousVersionId ?? undefined,
      installedBy: row.installedBy,
      installedChecksum: row.installedChecksum,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      skill: this.toSkillDto(row.skill),
      invocationCount: row._count?.invocations ?? row.invocations?.length ?? 0,
      recentInvocations: (row.invocations ?? []).map((invocation) => this.toInvocationDto(invocation)),
    };
  }

  private toSkillDto(row: {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    compatibility: unknown;
    permissions: unknown;
    entryPoints: unknown;
    checksum: string;
    source: string;
    validationStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }): SkillDto {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      author: row.author,
      compatibility: asRecord(row.compatibility) ?? {},
      permissions: asRecord(row.permissions) ?? {},
      entryPoints: asRecord(row.entryPoints) ?? {},
      checksum: row.checksum,
      source: row.source,
      validationStatus: row.validationStatus as SkillDto["validationStatus"],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInvocationDto(row: {
    id: string;
    installationId: string;
    runId: string | null;
    workerJobRef: string | null;
    adapter: string;
    permissionsUsed: unknown;
    argsRedacted: unknown;
    resultMeta: unknown;
    status: string;
    invokedAt: Date;
  }): SkillInvocationDto {
    return {
      id: row.id,
      installationId: row.installationId,
      runId: row.runId ?? undefined,
      workerJobRef: row.workerJobRef ?? undefined,
      adapter: row.adapter,
      permissionsUsed: asRecord(row.permissionsUsed),
      argsRedacted: asRecord(row.argsRedacted),
      resultMeta: asRecord(row.resultMeta),
      status: row.status as SkillInvocationDto["status"],
      invokedAt: row.invokedAt.toISOString(),
    };
  }

}


function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
