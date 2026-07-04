import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { RequirementDocumentsController } from "./requirement-documents.controller";
import { RequirementDocumentsService } from "./requirement-documents.service";
import { RequirementsController } from "./requirements.controller";
import { RequirementsService } from "./requirements.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [RequirementsController, RequirementDocumentsController],
  providers: [RequirementsService, RequirementDocumentsService],
  exports: [RequirementsService, RequirementDocumentsService],
})
export class RequirementsModule {}
