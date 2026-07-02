import { Module } from "@nestjs/common";
import { AiOrchestrationController } from "./ai-orchestration.controller";
import { AiOrchestrationService } from "./ai-orchestration.service";
import { LlmDraftService } from "./llm-draft.service";
import { ModelProvidersModule } from "../model-providers/model-providers.module";

@Module({
  imports: [ModelProvidersModule],
  controllers: [AiOrchestrationController],
  providers: [AiOrchestrationService, LlmDraftService],
  exports: [AiOrchestrationService],
})
export class AiOrchestrationModule {}
