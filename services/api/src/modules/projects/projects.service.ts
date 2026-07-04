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
  ProjectWorkspaceSummaryDto,
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

  async getWorkspaceSummary(
    projectId: string,
  ): Promise<ProjectWorkspaceSummaryDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    const [
      testCases,
      aiGeneratedCases,
      testSuites,
      executions,
      queuedExecutions,
      failedExecutions,
      reportArtifacts,
      apiCases,
      apiExecutions,
      requirements,
      approvedRequirements,
      aiRuns,
      knowledgeBases,
      knowledgeDocuments,
      chatSessions,
      mcpTools,
      approvedMcpTools,
      skills,
      enabledSkills,
      latestRequirement,
      latestCase,
      latestExecution,
    ] = await Promise.all([
      this.prisma.testCase.count({ where: { projectId } }),
      this.prisma.testCase.count({
        where: { projectId, origin: "ai_generated" },
      }),
      this.prisma.testSuite.count({ where: { projectId } }),
      this.prisma.testExecution.count({ where: { projectId } }),
      this.prisma.testExecution.count({
        where: { projectId, status: "queued" },
      }),
      this.prisma.testExecution.count({
        where: { projectId, status: "failed" },
      }),
      this.prisma.executionArtifact.count({
        where: { type: "report", execution: { projectId } },
      }),
      this.prisma.apiTestCase.count({ where: { projectId } }),
      this.prisma.apiExecution.count({ where: { projectId } }),
      this.prisma.requirement.count({ where: { projectId } }),
      this.prisma.requirement.count({
        where: { projectId, status: "approved" },
      }),
      this.prisma.aiWorkflowRun.count({ where: { projectId } }),
      this.prisma.knowledgeBase.count({ where: { projectId } }),
      this.prisma.document.count({ where: { knowledgeBase: { projectId } } }),
      this.prisma.chatSession.count({ where: { projectId } }),
      this.prisma.mcpTool.count({ where: { projectId } }),
      this.prisma.mcpTool.count({
        where: { projectId, status: "approved" },
      }),
      this.prisma.skillInstallation.count({ where: { projectId } }),
      this.prisma.skillInstallation.count({
        where: { projectId, state: "installed" },
      }),
      this.prisma.requirement.findFirst({
        where: { projectId },
        orderBy: { updatedAt: "desc" },
        select: { title: true, status: true, updatedAt: true },
      }),
      this.prisma.testCase.findFirst({
        where: { projectId },
        orderBy: { updatedAt: "desc" },
        select: { title: true, origin: true, updatedAt: true },
      }),
      this.prisma.testExecution.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: { status: true, environment: true, createdAt: true },
      }),
    ]);

    const counts: ProjectWorkspaceSummaryDto["counts"] = {
      testCases,
      testSuites,
      executions,
      queuedExecutions,
      failedExecutions,
      reportArtifacts,
      apiCases,
      apiExecutions,
      requirements,
      approvedRequirements,
      aiRuns,
      aiGeneratedCases,
      knowledgeBases,
      knowledgeDocuments,
      chatSessions,
      mcpTools,
      approvedMcpTools,
      skills,
      enabledSkills,
    };

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      counts,
      modules: this.workspaceModules(projectId, counts),
      recentActivity: this.recentActivity(projectId, {
        latestRequirement,
        latestCase,
        latestExecution,
      }),
    };
  }

  private workspaceModules(
    projectId: string,
    counts: ProjectWorkspaceSummaryDto["counts"],
  ): ProjectWorkspaceSummaryDto["modules"] {
    const route = (path: string) => `/projects/${projectId}/${path}`;

    return [
      {
        key: "requirements",
        label: "Requirements",
        count: counts.requirements,
        complete: counts.approvedRequirements > 0,
        nextAction: counts.requirements
          ? "Review and approve the next requirement"
          : "Capture first requirement",
        gap: counts.approvedRequirements
          ? "Approved requirement ready for generation"
          : "No approved requirement yet",
        to: route("requirements"),
      },
      {
        key: "ai-generation",
        label: "AI case generation",
        count: counts.aiRuns,
        complete: counts.aiRuns > 0,
        nextAction: counts.approvedRequirements
          ? "Generate cases from an approved requirement"
          : "Approve a requirement before generating cases",
        gap: counts.aiRuns ? "Generation history exists" : "No generation run yet",
        to: route("ai-generation"),
      },
      {
        key: "test-cases",
        label: "Case management",
        count: counts.testCases,
        complete: counts.testCases > 0,
        nextAction: counts.testCases
          ? "Review case coverage and ownership"
          : "Accept generated cases or add one manually",
        gap: counts.aiGeneratedCases
          ? "Generated cases are linked"
          : "No AI-generated case linked yet",
        to: route("test-cases"),
      },
      {
        key: "test-suites",
        label: "Suite execution",
        count: counts.testSuites,
        complete: counts.testSuites > 0,
        nextAction: counts.testSuites
          ? "Run the next regression suite"
          : "Create a suite from approved cases",
        gap: counts.testSuites ? "Suite is available" : "No suite assembled yet",
        to: route("test-suites"),
      },
      {
        key: "executions",
        label: "Execution queue",
        count: counts.executions,
        complete: counts.executions > 0,
        nextAction: counts.queuedExecutions
          ? "Watch queued executions"
          : "Start a run from a case or suite",
        gap: counts.failedExecutions
          ? `${counts.failedExecutions} failed execution needs triage`
          : "No failed executions",
        to: route("executions"),
      },
      {
        key: "api-automation",
        label: "API automation",
        count: counts.apiCases,
        complete: counts.apiCases > 0,
        nextAction: counts.apiCases
          ? "Review assertions and environments"
          : "Add API checks after the core flow is stable",
        gap: counts.apiExecutions
          ? "API execution evidence exists"
          : "No API execution evidence yet",
        to: route("api-automation"),
      },
      {
        key: "reports",
        label: "Execution report",
        count: counts.reportArtifacts,
        complete: counts.reportArtifacts > 0,
        nextAction: counts.reportArtifacts
          ? "Open the latest report artifact"
          : "Run a suite to publish a report",
        gap: counts.reportArtifacts ? "Report artifact available" : "No report artifact yet",
        to: route("executions"),
      },
    ];
  }

  private recentActivity(
    projectId: string,
    activity: {
      latestRequirement: {
        title: string;
        status: string;
        updatedAt: Date;
      } | null;
      latestCase: {
        title: string;
        origin: string;
        updatedAt: Date;
      } | null;
      latestExecution: {
        status: string;
        environment: string;
        createdAt: Date;
      } | null;
    },
  ): ProjectWorkspaceSummaryDto["recentActivity"] {
    const items: ProjectWorkspaceSummaryDto["recentActivity"] = [];

    if (activity.latestRequirement) {
      items.push({
        label: "Requirement updated",
        detail: `${activity.latestRequirement.title} is ${activity.latestRequirement.status}`,
        at: activity.latestRequirement.updatedAt.toISOString(),
        to: `/projects/${projectId}/requirements`,
      });
    }

    if (activity.latestCase) {
      items.push({
        label: "Test case updated",
        detail: `${activity.latestCase.title} (${activity.latestCase.origin.replace("_", " ")})`,
        at: activity.latestCase.updatedAt.toISOString(),
        to: `/projects/${projectId}/test-cases`,
      });
    }

    if (activity.latestExecution) {
      items.push({
        label: "Execution updated",
        detail: `${activity.latestExecution.environment} run is ${activity.latestExecution.status}`,
        at: activity.latestExecution.createdAt.toISOString(),
        to: `/projects/${projectId}/executions`,
      });
    }

    if (!items.length) {
      items.push({
        label: "Workspace is ready",
        detail: "Capture the first requirement to begin the managed testing flow",
        to: `/projects/${projectId}/requirements`,
      });
    }

    return items;
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
