import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { RequirementDocumentsController } from "./requirement-documents.controller";
import { RequirementDocumentsService } from "./requirement-documents.service";
import { RequirementModulesController } from "./requirement-modules.controller";
import { RequirementModulesService } from "./requirement-modules.service";
import { RequirementsController } from "./requirements.controller";
import { RequirementsService } from "./requirements.service";

@Module({
  imports: [AuditModule, PrismaModule, AiOrchestrationModule],
  controllers: [RequirementsController, RequirementDocumentsController, RequirementModulesController],
  providers: [RequirementsService, RequirementDocumentsService, RequirementModulesService],
  exports: [RequirementsService, RequirementDocumentsService, RequirementModulesService],
})
export class RequirementsModule {}
