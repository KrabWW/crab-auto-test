import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import { AbstractAuthGuard } from "../../common/abstract-auth.guard";
import { CURRENT_USER, type RequestUser } from "../../common/auth.decorators";

/** Verifies the session JWT and attaches req.user. */
@Injectable()
export class SessionAuthGuard extends AbstractAuthGuard {
  private readonly jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  });

  constructor() {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(req);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(
        token,
      );
      const user: RequestUser = {
        userId: payload.sub,
        email: payload.email,
        isAdmin: false,
      };
      (req as unknown as Record<string, RequestUser>)[CURRENT_USER] = user;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}

export { CURRENT_USER };
