import { Module } from "@nestjs/common";
import { ModelProvidersController } from "./model-providers.controller";
import { ModelProvidersService } from "./model-providers.service";

@Module({
  controllers: [ModelProvidersController],
  providers: [ModelProvidersService],
  exports: [ModelProvidersService],
})
export class ModelProvidersModule {}
