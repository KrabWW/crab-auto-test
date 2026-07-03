import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { LlmChatService } from "./llm-chat.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type { CreateChatSessionRequest, SendChatMessageRequest } from "@crab/shared-types";

@Controller("projects/:projectId/chat")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class LlmChatController {
  constructor(private readonly chat: LlmChatService) {}

  @Get("sessions")
  list(@Param("projectId") projectId: string) {
    return this.chat.listSessions(projectId);
  }

  @Post("sessions")
  create(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateChatSessionRequest,
  ) {
    return this.chat.createSession(projectId, user.userId, body);
  }

  @Get("sessions/:sessionId")
  get(@Param("projectId") projectId: string, @Param("sessionId") sessionId: string) {
    return this.chat.getSession(projectId, sessionId);
  }

  @Post("sessions/:sessionId/messages")
  send(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: SendChatMessageRequest,
  ) {
    return this.chat.sendMessage(projectId, sessionId, user.userId, body);
  }

  @Get("context-options")
  contextOptions(@Param("projectId") projectId: string) {
    return this.chat.contextOptions(projectId);
  }
}
