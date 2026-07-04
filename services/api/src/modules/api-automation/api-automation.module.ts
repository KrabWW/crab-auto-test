import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ApiAutomationController } from "./api-automation.controller";
import { ApiAutomationService } from "./api-automation.service";
import { ApiGlobalHeadersController } from "./api-global-headers.controller";
import { ApiGlobalHeadersService } from "./api-global-headers.service";
import { ApiScenariosController } from "./api-scenarios.controller";
import { ApiScenariosService } from "./api-scenarios.service";

@Module({
  imports: [AuditModule],
  controllers: [ApiAutomationController, ApiScenariosController, ApiGlobalHeadersController],
  providers: [ApiAutomationService, ApiScenariosService, ApiGlobalHeadersService],
  exports: [ApiAutomationService, ApiScenariosService, ApiGlobalHeadersService],
})
export class ApiAutomationModule {}
