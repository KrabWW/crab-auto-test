import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ModelProvidersModule } from "../model-providers/model-providers.module";
import { LlmChatController } from "./llm-chat.controller";
import { ChatLlmService } from "./chat-llm.service";
import { LlmChatService } from "./llm-chat.service";

@Module({
  imports: [AuditModule, KnowledgeModule, ModelProvidersModule],
  controllers: [LlmChatController],
  providers: [ChatLlmService, LlmChatService],
  exports: [LlmChatService],
})
export class LlmChatModule {}
