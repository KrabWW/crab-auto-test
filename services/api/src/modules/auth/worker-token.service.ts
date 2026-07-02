import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { nanoid } from "nanoid";
import type {
  WorkerTokenDto,
  WorkerTokenRefreshRequest,
} from "@crab/shared-types";
import { AuditService } from "../audit/audit.service";

/**
 * R3: per-user worker token.
 * Minted at desktop login, bound to userId, short TTL + refresh.
 * Backend rejects worker results for jobs not assigned to that user's worker
 * (enforced in WorkerGatewayModule).
 */
@Injectable()
export class WorkerTokenService {
  private readonly refreshTtlSec = Number(
    process.env.WORKER_TOKEN_REFRESH_TTL_SECONDS ?? 86400,
  );
  private readonly ttlSec = Number(process.env.WORKER_TOKEN_TTL_SECONDS ?? 300);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async mint(userId: string): Promise<WorkerTokenDto> {
    const refreshId = nanoid(24);
    const token = await this.jwt.sign(
      { sub: userId, kind: "worker", jti: refreshId },
      { expiresIn: `${this.ttlSec}s` },
    );
    const refreshToken = await this.jwt.sign(
      { sub: userId, kind: "worker-refresh", jti: refreshId },
      { expiresIn: `${this.refreshTtlSec}s` },
    );
    await this.audit.record({
      actorId: userId,
      action: "auth.worker-token.mint",
      targetType: "user",
      targetId: userId,
      outcome: "success",
    });
    return {
      token,
      userId,
      expiresAt: new Date(Date.now() + this.ttlSec * 1000).toISOString(),
      refreshToken,
    };
  }

  async refresh(req: WorkerTokenRefreshRequest): Promise<WorkerTokenDto> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        kind: string;
      }>(req.refreshToken);
      if (payload.kind !== "worker-refresh") {
        throw new UnauthorizedException("Not a worker refresh token");
      }
      return this.mint(payload.sub);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /** Verify a worker token; returns the bound userId or throws. */
  async verify(token: string): Promise<{ userId: string }> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        kind: string;
      }>(token);
      if (payload.kind !== "worker") {
        throw new UnauthorizedException("Not a worker token");
      }
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedException("Invalid worker token");
    }
  }
}
