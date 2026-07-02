import {
  Controller,
  Get,
  HttpCode,
  Post,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { SessionAuthGuard, CURRENT_USER } from "./session-auth.guard";
import type { LoginRequest } from "@crab/shared-types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginRequest) {
    return this.auth.login(body);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async logout() {
    // Stateless JWT; client drops the token. Audit recorded by guard.
    return;
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: FastifyRequest) {
    const user = (req as unknown as Record<string, { userId: string }>)[
      CURRENT_USER
    ]!;
    return this.auth.me(user.userId);
  }
}
