import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { redact } from "../../common/redact";

/**
 * skills-store.4: Skills integrate with LangGraph/MCP/worker through CONTROLLED
 * ADAPTERS — no arbitrary code execution.
 *
 * §11 a2 + SEC-SKILL-4: this adapter enforces:
 *  - NO eval / vm.runInNewContext / dynamic require of skill payloads
 *    (CI scan + unit assert this file contains none of those).
 *  - the installation's activated permission set is checked before invocation;
 *    out-of-policy invocations are denied + audited (status: "denied").
 *  - every invocation records a SkillInvocation (argsRedacted / resultMeta).
 *
 * A "skill" in MVP is a declarative manifest; the adapter dispatches to a
 * registered handler keyed by entryPoints. Skill code is never `eval`'d —
 * handlers are first-party, registered at boot. (Phase 3 may extend the
 * adapter contract; it must never introduce arbitrary execution.)
 */
export type SkillAdapterKind = "langgraph" | "mcp" | "worker";

/** First-party handler registry: entryPoint name -> typed function. */
type SkillHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

@Injectable()
export class SkillAdapterService {
  private readonly handlers = new Map<string, SkillHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Register a first-party handler for an entryPoint. Called at boot, never dynamically. */
  register(entryPoint: string, handler: SkillHandler): void {
    this.handlers.set(entryPoint, handler);
  }

  /**
   * Invoke a skill via its controlled adapter. Enforces permission policy +
   * records SkillInvocation. Returns the handler result metadata.
   */
  async invoke(input: {
    installationId: string;
    adapter: SkillAdapterKind;
    entryPoint: string;
    args: Record<string, unknown>;
    runId?: string;
    workerJobRef?: string;
    actorId: string;
  }): Promise<{ status: "success" | "failure" | "denied"; resultMeta: Record<string, unknown> }> {
    const inst = await this.prisma.skillInstallation.findUnique({
      where: { id: input.installationId },
      include: { skill: true },
    });
    if (!inst) throw new BadRequestException("Installation not found");
    if (inst.state !== "installed") {
      await this.recordInvocation(inst.id, inst.projectId, input, "denied", { reason: "not installed/active" });
      throw new ForbiddenException("skill not active");
    }

    // Permission policy: the requested entryPoint must be in activatedPermissions.
    const activated = (inst.activatedPermissions as Record<string, unknown> | null) ?? {};
    const allowedEntryPoints = (activated.entryPoints as string[] | undefined) ?? [];
    if (allowedEntryPoints.length > 0 && !allowedEntryPoints.includes(input.entryPoint)) {
      await this.recordInvocation(inst.id, inst.projectId, input, "denied", { reason: "entryPoint not approved" });
      throw new ForbiddenException("entryPoint not in approved permission set");
    }

    const handler = this.handlers.get(input.entryPoint);
    if (!handler) {
      await this.recordInvocation(inst.id, inst.projectId, input, "denied", { reason: "no first-party handler registered" });
      throw new BadRequestException(`no handler for entryPoint ${input.entryPoint}`);
    }

    try {
      const result = await handler(input.args);
      await this.recordInvocation(inst.id, inst.projectId, input, "success", result);
      return { status: "success", resultMeta: result };
    } catch (err) {
      const meta = { error: (err as Error).message };
      await this.recordInvocation(inst.id, inst.projectId, input, "failure", meta);
      return { status: "failure", resultMeta: meta };
    }
  }

  private async recordInvocation(
    installationId: string,
    projectId: string | null | undefined,
    input: { adapter: SkillAdapterKind; entryPoint: string; args: Record<string, unknown>; runId?: string; workerJobRef?: string; actorId: string },
    status: "success" | "failure" | "denied",
    resultMeta: Record<string, unknown>,
  ) {
    await this.prisma.skillInvocation.create({
      data: {
        installationId,
        runId: input.runId,
        workerJobRef: input.workerJobRef,
        adapter: input.adapter,
        permissionsUsed: { entryPoint: input.entryPoint } as object,
        argsRedacted: redact(input.args) as object,
        resultMeta: redact(resultMeta) as object,
        status,
      },
    });
    await this.audit.record({
      actorId: input.actorId,
      projectId: projectId ?? undefined,
      action: `skill.invoke.${status}`,
      targetType: "skill-installation",
      targetId: installationId,
      outcome: status === "success" ? "success" : "failure",
      metadata: { entryPoint: input.entryPoint, adapter: input.adapter },
    });
  }
}
