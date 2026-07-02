import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AiOrchestrationService } from "./ai-orchestration.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type {
  StartTestGenerationRequest,
  AcceptRunRequest,
  StreamEnvelope,
} from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class AiOrchestrationController {
  constructor(private readonly ai: AiOrchestrationService) {}

  @Post("ai/test-generation")
  start(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Omit<StartTestGenerationRequest, "projectId">,
  ) {
    return this.ai.startGeneration(user.userId, { ...body, projectId });
  }

  @Get("ai/runs/:runId")
  get(@Param("runId") runId: string) {
    return this.ai.get(runId);
  }

  @Get("ai/runs/:runId/snapshot")
  snapshot(@Param("runId") runId: string) {
    return this.ai.snapshotFor(runId);
  }

  /**
   * B2: SSE live stream of WorkflowStageEvents.
   * R8: clients refetch /snapshot on reconnect (no server-side replay buffer).
   */
  @Get("ai/runs/:runId/stream")
  async stream(
    @Param("runId") runId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Initial hello so the client knows the stream is open.
    reply.raw.write(`: stream-open runId=${runId}\n\n`);

    const unsubscribe = this.ai.subscribe(runId, (env: StreamEnvelope) => {
      reply.raw.write(`data: ${JSON.stringify(env)}\n\n`);
    });

    // Heartbeat every 15s to keep proxies from closing idle connections.
    const hb = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch {
        /* client gone */
      }
    }, 15000);

    reply.raw.on("close", () => {
      clearInterval(hb);
      unsubscribe();
    });
  }

  @Post("ai/runs/:runId/approve")
  approve(
    @Param("runId") runId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AcceptRunRequest,
  ) {
    return this.ai.accept(user.userId, runId, body);
  }

  @Post("ai/runs/:runId/reject")
  reject(@Param("runId") runId: string, @CurrentUser() user: RequestUser) {
    return this.ai.reject(user.userId, runId);
  }
}
