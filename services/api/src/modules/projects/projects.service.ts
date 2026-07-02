import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  ProjectDto,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectMemberDto,
  AddMemberRequest,
} from "@crab/shared-types";

/** platform-foundation.2: project CRUD + simple owner/member roles (no RBAC). */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    ownerId: string,
    req: CreateProjectRequest,
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.findUnique({
      where: { slug: req.slug },
    });
    if (existing) throw new ConflictException("Slug already in use");
    const project = await this.prisma.project.create({
      data: {
        name: req.name,
        slug: req.slug,
        description: req.description,
        ownerId,
        members: {
          create: { userId: ownerId, role: "owner", acceptedAt: new Date() },
        },
      },
    });
    await this.audit.record({
      actorId: ownerId,
      projectId: project.id,
      action: "project.create",
      targetType: "project",
      targetId: project.id,
      outcome: "success",
    });
    return this.toDto(project);
  }

  async listForUser(userId: string): Promise<ProjectDto[]> {
    const rows = await this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this.toDto);
  }

  async get(projectId: string): Promise<ProjectDto> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!p) throw new NotFoundException("Project not found");
    return this.toDto(p);
  }

  async update(
    projectId: string,
    req: UpdateProjectRequest,
  ): Promise<ProjectDto> {
    const p = await this.prisma.project.update({
      where: { id: projectId },
      data: { name: req.name, description: req.description },
    });
    return this.toDto(p);
  }

  async listMembers(projectId: string): Promise<ProjectMemberDto[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
    });
    return rows.map((r): ProjectMemberDto => ({
      id: r.id,
      projectId: r.projectId,
      userId: r.userId,
      role: r.role,
      invitedAt: r.invitedAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString(),
    }));
  }

  async addMember(
    projectId: string,
    req: AddMemberRequest,
    actorId: string,
  ): Promise<ProjectMemberDto> {
    const m = await this.prisma.projectMember.create({
      data: { projectId, userId: req.userId, role: req.role },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "project.member.add",
      targetType: "project-member",
      targetId: m.id,
      outcome: "success",
    });
    return {
      id: m.id,
      projectId: m.projectId,
      userId: m.userId,
      role: m.role,
      invitedAt: m.invitedAt.toISOString(),
      acceptedAt: m.acceptedAt?.toISOString(),
    };
  }

  /** Resolve a user's role in a project (or null if not a member). */
  async resolveRole(
    projectId: string,
    userId: string,
  ): Promise<"owner" | "member" | null> {
    const m = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return m?.role ?? null;
  }

  private toDto = (p: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectDto => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? undefined,
    ownerId: p.ownerId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  });
}
