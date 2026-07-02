import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  type CanActivate,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import type { ProjectRole } from "@crab/shared-types";

export const CURRENT_USER = "currentUser";

export interface RequestUser {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
  },
);

export const ROLES_KEY = "projectRoles";

/** Restrict a route to specific project roles (owner/member). Simple roles only (§11 a2). */
export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ProjectRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER];
    if (!user) throw new ForbiddenException("No authenticated user");
    // Membership is resolved by the ProjectsModule's membership loader on the request.
    const role = (req as unknown as Record<string, ProjectRole | undefined>)
      .projectRole;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException(
        `Requires project role: ${required.join(" | ")}`,
      );
    }
    return true;
  }
}
