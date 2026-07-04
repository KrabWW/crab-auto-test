import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { McpModule } from "../mcp/mcp.module";
import { ModelProvidersModule } from "../model-providers/model-providers.module";
import { SkillsModule } from "../skills/skills.module";
import { TestAssetsModule } from "../test-assets/test-assets.module";
import { AiOrchestrationController } from "./ai-orchestration.controller";
import { AiOrchestrationService } from "./ai-orchestration.service";
import { LlmDraftService } from "./llm-draft.service";

@Module({
  imports: [AuditModule, KnowledgeModule, McpModule, ModelProvidersModule, SkillsModule, TestAssetsModule],
  controllers: [AiOrchestrationController],
  providers: [AiOrchestrationService, LlmDraftService],
  exports: [AiOrchestrationService, LlmDraftService],
})
export class AiOrchestrationModule {}
