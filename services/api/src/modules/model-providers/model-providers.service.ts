import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { EnvelopeEncryptionService } from "../../infra/crypto/envelope-encryption.service";
import { AuditService } from "../audit/audit.service";
import type {
  ModelProviderDto,
  CreateModelProviderRequest,
  ValidateProviderResponse,
  ModelProviderKind,
} from "@crab/shared-types";

/**
 * platform-foundation.3 + Architect-R5.
 * Credentials are envelope-encrypted; `validate` decrypts in-process and
 * NEVER returns the secret. DTOs strip credentialCiphertext/keyId (typed `never`).
 */
@Injectable()
export class ModelProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly audit: AuditService,
  ) {}

  async create(
    createdBy: string,
    req: CreateModelProviderRequest,
  ): Promise<ModelProviderDto> {
    if (req.scope === "project") {
      if (!req.projectId) throw new BadRequestException("projectId is required for project-scoped providers");
      await this.ensureProjectMember(createdBy, req.projectId);
    }
    const env = this.crypto.encrypt(req.credential);
    const provider = await this.prisma.modelProvider.create({
      data: {
        scope: req.scope,
        projectId: req.projectId,
        name: req.name,
        kind: req.kind,
        baseUrl: req.baseUrl,
        modelName: req.modelName,
        credentialCiphertext: Buffer.from(env.blob, "base64"),
        credentialKeyId: env.keyId,
        createdBy,
      },
    });
    await this.audit.record({
      actorId: createdBy,
      projectId: req.projectId,
      action: "model-provider.create",
      targetType: "model-provider",
      targetId: provider.id,
      outcome: "success",
    });
    return this.toDto(provider);
  }

  async list(projectId?: string): Promise<ModelProviderDto[]> {
    const rows = await this.prisma.modelProvider.findMany({
      where: projectId
        ? { OR: [{ scope: "global" }, { scope: "project", projectId }] }
        : { scope: "global" },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this.toDto);
  }

  async listForUser(
    user: { userId: string; isAdmin?: boolean },
    projectId?: string,
  ): Promise<ModelProviderDto[]> {
    if (projectId && !user.isAdmin) {
      await this.ensureProjectMember(user.userId, projectId);
    }
    return this.list(projectId);
  }

  async validate(id: string, actorId: string): Promise<ValidateProviderResponse> {
    const provider = await this.prisma.modelProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.projectId) {
      await this.ensureProjectMember(actorId, provider.projectId);
    }
    const plaintext = this.crypto.decrypt({
      blob: provider.credentialCiphertext.toString("base64"),
      keyId: provider.credentialKeyId,
    });
    // Minimal validation: a non-empty key + reachable base URL. Real validation
    // hits the provider's models endpoint; that wiring is a P2 task with the
    // actual LLM SDK. For MVP we assert shape only.
    if (!plaintext || plaintext.length < 8) {
      const updated = await this.prisma.modelProvider.update({
        where: { id },
        data: { status: "invalid", lastValidatedAt: new Date() },
      });
      await this.audit.record({
        actorId,
        projectId: provider.projectId ?? undefined,
        action: "model-provider.validate",
        targetType: "model-provider",
        targetId: id,
        outcome: "failure",
      });
      return { id, status: updated.status, lastValidatedAt: updated.lastValidatedAt!.toISOString(), error: "Credential too short" };
    }
    const updated = await this.prisma.modelProvider.update({
      where: { id },
      data: { status: "valid", lastValidatedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      projectId: provider.projectId ?? undefined,
      action: "model-provider.validate",
      targetType: "model-provider",
      targetId: id,
      outcome: "success",
    });
    return {
      id,
      status: updated.status,
      lastValidatedAt: updated.lastValidatedAt!.toISOString(),
    };
  }

  /** Resolve provider config + plaintext credential for server-side orchestration. In-process only. */
  async resolveForOrchestration(
    id: string,
    kind: ModelProviderKind,
  ): Promise<{ baseUrl: string; modelName: string; credential: string }> {
    const provider = await this.prisma.modelProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.kind !== kind) {
      throw new BadRequestException(
        `Provider ${id} is not a ${kind} provider`,
      );
    }
    const credential = this.crypto.decrypt({
      blob: provider.credentialCiphertext.toString("base64"),
      keyId: provider.credentialKeyId,
    });
    return { baseUrl: provider.baseUrl, modelName: provider.modelName, credential };
  }

  private toDto = (p: {
    id: string;
    scope: "global" | "project";
    projectId: string | null;
    name: string;
    kind: ModelProviderKind;
    baseUrl: string;
    modelName: string;
    status: "unvalidated" | "valid" | "invalid";
    lastValidatedAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): ModelProviderDto => ({
    id: p.id,
    scope: p.scope,
    projectId: p.projectId ?? undefined,
    name: p.name,
    kind: p.kind,
    baseUrl: p.baseUrl,
    modelName: p.modelName,
    status: p.status,
    lastValidatedAt: p.lastValidatedAt?.toISOString(),
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  });

  private async ensureProjectMember(userId: string, projectId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) throw new ForbiddenException("Not a member of this project");
  }
}
