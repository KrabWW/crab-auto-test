import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/** Extracts & verifies the bearer session token; attaches req.user. */
@Injectable()
export abstract class AbstractAuthGuard implements CanActivate {
  abstract canActivate(ctx: ExecutionContext): boolean | Promise<boolean>;

  protected extractToken(req: FastifyRequest): string {
    const header = (req.headers.authorization ?? "") as string;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new UnauthorizedException("Missing bearer token");
    return match[1]!;
  }
}
