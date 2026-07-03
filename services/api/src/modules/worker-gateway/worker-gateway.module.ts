import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExecutionsModule } from "../executions/executions.module";
import { WorkerGatewayController } from "./worker-gateway.controller";
import { WorkerGatewayService } from "./worker-gateway.service";
import { WorkerAuthGuard } from "./worker-auth.guard";

@Module({
  imports: [AuthModule, ExecutionsModule],
  controllers: [WorkerGatewayController],
  providers: [WorkerGatewayService, WorkerAuthGuard],
  exports: [WorkerGatewayService],
})
export class WorkerGatewayModule {}
