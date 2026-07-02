import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { WorkerTokenService } from "../auth/worker-token.service";
import { CURRENT_USER, type RequestUser } from "../../common/auth.decorators";

/** R3: verifies the per-user worker token on worker→backend calls. */
@Injectable()
export class WorkerAuthGuard implements CanActivate {
  constructor(private readonly workerToken: WorkerTokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const header = (req.headers.authorization ?? "") as string;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new UnauthorizedException("Missing worker token");
    const { userId } = await this.workerToken.verify(match[1]!);
    const user: RequestUser = { userId, email: "", isAdmin: false };
    (req as unknown as Record<string, RequestUser>)[CURRENT_USER] = user;
    return true;
  }
}
