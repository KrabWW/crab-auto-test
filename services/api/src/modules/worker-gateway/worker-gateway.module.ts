import { Module } from "@nestjs/common";
import { WorkerGatewayController } from "./worker-gateway.controller";
import { WorkerGatewayService } from "./worker-gateway.service";
import { WorkerAuthGuard } from "./worker-auth.guard";

@Module({
  controllers: [WorkerGatewayController],
  providers: [WorkerGatewayService, WorkerAuthGuard],
  exports: [WorkerGatewayService],
})
export class WorkerGatewayModule {}
