import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { WorkerGatewayService } from "./worker-gateway.service";
import { WorkerAuthGuard } from "./worker-auth.guard";
import { CURRENT_USER, type RequestUser } from "../../common/auth.decorators";
import type { WorkerMessage } from "@crab/shared-types";

/**
 * Worker gateway (F3). Worker authenticates with per-user token (R3), then
 * claims jobs and reports ack/heartbeat/logs/result/artifacts over REST.
 *
 * NOTE: MVP uses a request-per-message REST shape for simplicity. The R2
 * "session stream" semantics (long-lived WS/SSE) are exercised in the desktop
 * worker client; the redelivery contract (MUST-5) is enforced by the
 * dispatched-state persistence here — on reconnect the worker re-claims
 * any `dispatched` execution that never reached `running`/terminal.
 */
@Controller("worker")
@UseGuards(WorkerAuthGuard)
export class WorkerGatewayController {
  constructor(private readonly gateway: WorkerGatewayService) {}

  @Post("jobs/claim")
  @HttpCode(200)
  async claim(@Req() req: FastifyRequest) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    // R2 redelivery: the worker polls claim; a dispatched-but-unacked job is
    // re-delivered because we only flip to `running` on ack.
    const send = (_m: unknown) => {
      /* no-op in REST mode; the returned job IS the dispatch */
    };
    const job = await this.gateway.claimAndDispatch(user.userId, send as never);
    return { job };
  }

  @Post("jobs/:id/heartbeat")
  @HttpCode(204)
  async heartbeat(
    @Req() req: FastifyRequest,
    @Body() body: WorkerMessage,
  ) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    await this.gateway.ingestMessage(user.userId, body);
  }

  @Post("jobs/:id/result")
  @HttpCode(204)
  async result(@Req() req: FastifyRequest, @Body() body: WorkerMessage) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    await this.gateway.ingestMessage(user.userId, body);
  }

  @Post("jobs/:id/artifacts")
  @HttpCode(204)
  async artifacts(@Req() req: FastifyRequest, @Body() body: WorkerMessage) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    await this.gateway.ingestMessage(user.userId, body);
  }

  @Post("jobs/:id/ack")
  @HttpCode(204)
  async ack(@Req() req: FastifyRequest, @Body() body: WorkerMessage) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    await this.gateway.ingestMessage(user.userId, body);
  }

  @Post("jobs/:id/logs")
  @HttpCode(204)
  async logs(@Req() req: FastifyRequest, @Body() body: WorkerMessage) {
    const user = (req as unknown as Record<string, RequestUser>)[CURRENT_USER]!;
    await this.gateway.ingestMessage(user.userId, body);
  }
}
