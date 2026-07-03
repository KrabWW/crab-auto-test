import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./session-auth.guard";
import { WorkerTokenService } from "./worker-token.service";

@Module({
  imports: [
    AuditModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
      signOptions: { expiresIn: `${process.env.JWT_TTL_SECONDS ?? 900}s` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, WorkerTokenService],
  exports: [AuthService, SessionAuthGuard, WorkerTokenService],
})
export class AuthModule {}
