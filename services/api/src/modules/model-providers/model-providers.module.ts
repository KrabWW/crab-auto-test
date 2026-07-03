import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ModelProvidersController } from "./model-providers.controller";
import { ModelProvidersService } from "./model-providers.service";

@Module({
  imports: [AuditModule],
  controllers: [ModelProvidersController],
  providers: [ModelProvidersService],
  exports: [ModelProvidersService],
})
export class ModelProvidersModule {}
