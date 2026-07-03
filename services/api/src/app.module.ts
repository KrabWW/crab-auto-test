import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { CryptoModule } from "./infra/crypto/crypto.module";
import { StreamingModule } from "./infra/streaming/streaming.module";
import { RetrievalModule } from "./infra/retrieval/retrieval.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ModelProvidersModule } from "./modules/model-providers/model-providers.module";
import { TestAssetsModule } from "./modules/test-assets/test-assets.module";
import { ExecutionsModule } from "./modules/executions/executions.module";
import { WorkerGatewayModule } from "./modules/worker-gateway/worker-gateway.module";
import { AiOrchestrationModule } from "./modules/ai-orchestration/ai-orchestration.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { SkillsModule } from "./modules/skills/skills.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    StreamingModule,
    RetrievalModule,
    AuthModule,
    ProjectsModule,
    AuditModule,
    ModelProvidersModule,
    TestAssetsModule,
    ExecutionsModule,
    WorkerGatewayModule,
    AiOrchestrationModule,
    KnowledgeModule,
    SkillsModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
