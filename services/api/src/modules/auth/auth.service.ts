import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
 import { PrismaService } from "../../infra/prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type {
  LoginRequest,
  SessionDto,
  UserDto,
} from "@crab/shared-types";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(req: LoginRequest): Promise<SessionDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: req.email },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(req.password, user.passwordHash);
    if (!ok) {
      await this.audit.record({
        actorId: user.id,
        action: "auth.login",
        targetType: "user",
        targetId: user.id,
        outcome: "failure",
      });
      throw new UnauthorizedException("Invalid credentials");
    }
    const token = await this.jwt.sign({ sub: user.id, email: user.email });
    const session: SessionDto = {
      user: this.toDto(user),
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    };
    await this.audit.record({
      actorId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
    });
    return session;
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return this.toDto(user);
  }

  /** Dev-only seeding helper for the first admin user. */
  async ensureSeedAdmin(email: string, password: string): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return this.toDto(existing);
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: email.split("@")[0]!,
        passwordHash: await bcrypt.hash(password, 12),
        isAdmin: true,
      },
    });
    return this.toDto(user);
  }

  private toDto(u: {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    createdAt: Date;
  }): UserDto {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt.toISOString(),
    };
  }
}

// Re-export nanoid for token ids used elsewhere.
export { nanoid };
