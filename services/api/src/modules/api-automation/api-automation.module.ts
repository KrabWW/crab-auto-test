import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ApiAutomationController } from "./api-automation.controller";
import { ApiAutomationService } from "./api-automation.service";

@Module({
  imports: [AuditModule],
  controllers: [ApiAutomationController],
  providers: [ApiAutomationService],
})
export class ApiAutomationModule {}
