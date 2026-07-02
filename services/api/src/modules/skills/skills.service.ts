import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { createHash } from "node:crypto";

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
export interface SkillPackageManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  compatibility: Record<string, unknown>;
  permissions: Record<string, unknown>;
  entryPoints: Record<string, unknown>;
  /** sha256 of the package payload (declared; verified against computed). */
  checksum: string;
  source: string;
  /** The package payload (used to compute the actual checksum). */
  payload?: string;
}

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

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
    projectId: string | null,
    actorId: string,
    manifest: SkillPackageManifest,
  ) {
    const check = this.validatePackage(manifest);
    if (!check.valid) {
      // Record the failed attempt; current installation untouched.
      await this.audit.record({
        actorId,
        projectId: projectId ?? undefined,
        action: "skill.install.validate-failed",
        targetType: "skill",
        targetId: `${manifest.name}@${manifest.version}`,
        outcome: "failure",
        metadata: { error: check.error },
      });
      throw new BadRequestException(`skill validation failed: ${check.error}`);
    }

    // Upsert the Skill record (validated).
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
      update: { validationStatus: "valid" },
    });

    // Preserve previous version for rollback (skills-store.5).
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
      projectId: projectId ?? undefined,
      action: "skill.install",
      targetType: "skill-installation",
      targetId: installation.id,
      outcome: "success",
      metadata: { name: manifest.name, version: manifest.version, previousVersion: previous?.skillId },
    });
    return installation;
  }

  /** skills-store.3: explicit permission review + activation approval. */
  async approvePermissions(
    installationId: string,
    actorId: string,
    permissions: Record<string, unknown>,
  ) {
    const inst = await this.prisma.skillInstallation.findUnique({
      where: { id: installationId },
    });
    if (!inst) throw new NotFoundException("Installation not found");
    const updated = await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { activatedPermissions: permissions as object },
    });
    await this.audit.record({
      actorId,
      projectId: inst.projectId ?? undefined,
      action: "skill.permissions.approve",
      targetType: "skill-installation",
      targetId: installationId,
      outcome: "success",
    });
    return updated;
  }

  async listInstallations(projectId?: string) {
    return this.prisma.skillInstallation.findMany({
      where: projectId ? { projectId } : undefined,
      include: { skill: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async disable(installationId: string, actorId: string) {
    const inst = await this.prisma.skillInstallation.findUnique({ where: { id: installationId } });
    if (!inst) throw new NotFoundException("Installation not found");
    const updated = await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { state: "disabled" },
    });
    await this.audit.record({
      actorId, projectId: inst.projectId ?? undefined,
      action: "skill.disable", targetType: "skill-installation",
      targetId: installationId, outcome: "success",
    });
    return updated;
  }

  async uninstall(installationId: string, actorId: string) {
    const inst = await this.prisma.skillInstallation.findUnique({ where: { id: installationId } });
    if (!inst) throw new NotFoundException("Installation not found");
    const updated = await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { state: "uninstalled" },
    });
    await this.audit.record({
      actorId, projectId: inst.projectId ?? undefined,
      action: "skill.uninstall", targetType: "skill-installation",
      targetId: installationId, outcome: "success",
    });
    return updated;
  }

  /**
   * skills-store.5: rollback to previous compatible version.
   * If the previous version is missing/incompatible, keep the current version
   * active and report the failure (no half-state).
   */
  async rollback(installationId: string, actorId: string) {
    const inst = await this.prisma.skillInstallation.findUnique({
      where: { id: installationId },
    });
    if (!inst) throw new NotFoundException("Installation not found");
    if (!inst.previousVersionId) {
      throw new BadRequestException("no previous version to roll back to");
    }
    const previousSkill = await this.prisma.skill.findUnique({
      where: { id: inst.previousVersionId },
    });
    if (!previousSkill || previousSkill.validationStatus !== "valid") {
      // Keep current version active; report failure.
      await this.audit.record({
        actorId, projectId: inst.projectId ?? undefined,
        action: "skill.rollback.failed", targetType: "skill-installation",
        targetId: installationId, outcome: "failure",
        metadata: { reason: "previous version invalid or missing" },
      });
      throw new BadRequestException("previous version invalid or missing; current version kept active");
    }
    const rolled = await this.prisma.skillInstallation.update({
      where: { id: installationId },
      data: { skillId: previousSkill.id, installedChecksum: previousSkill.checksum },
    });
    await this.audit.record({
      actorId, projectId: inst.projectId ?? undefined,
      action: "skill.rollback", targetType: "skill-installation",
      targetId: installationId, outcome: "success",
      metadata: { toVersion: previousSkill.version },
    });
    return rolled;
  }
}
