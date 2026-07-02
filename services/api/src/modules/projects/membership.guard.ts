import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CURRENT_USER, type RequestUser } from "../../common/auth.decorators";

/**
 * Resolves the caller's project membership and stashes req.projectRole.
 * Simple roles only (owner/member) — no complex RBAC (§11 a2).
 */
@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER];
    if (!user) throw new ForbiddenException("No authenticated user");

    const params = (req.params ?? {}) as Record<string, string>;
    const projectId =
      params.projectId ?? params.id ?? (req.body as { projectId?: string })?.projectId;
    if (!projectId) return true; // route is not project-scoped; let other guards decide

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.userId } },
    });
    if (!membership) {
      throw new ForbiddenException("Not a member of this project");
    }
    (req as unknown as Record<string, "owner" | "member">).projectRole =
      membership.role;
    return true;
  }
}
