import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ApiAutomationController } from "./api-automation.controller";
import { ApiAutomationService } from "./api-automation.service";
import { ApiScenariosController } from "./api-scenarios.controller";
import { ApiScenariosService } from "./api-scenarios.service";

@Module({
  imports: [AuditModule],
  controllers: [ApiAutomationController, ApiScenariosController],
  providers: [ApiAutomationService, ApiScenariosService],
})
export class ApiAutomationModule {}
